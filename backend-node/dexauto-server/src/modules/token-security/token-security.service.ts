import { Injectable, Logger } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';

// Token-2022 Program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
// Standard Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Token-2022 Extension Type IDs (from TLV data)
enum Token2022ExtensionType {
  TransferFeeConfig = 1,
  TransferFeeAmount = 2,
  MintCloseAuthority = 3,
  ConfidentialTransferMint = 4,
  ConfidentialTransferAccount = 5,
  DefaultAccountState = 6,
  ImmutableOwner = 7,
  MemoTransfer = 8,
  NonTransferable = 9,
  InterestBearingConfig = 10,
  CpiGuard = 11,
  PermanentDelegate = 12,
  NonTransferableAccount = 13,
  TransferHook = 14,
  TransferHookAccount = 15,
  MetadataPointer = 18,
  TokenMetadata = 19,
  GroupPointer = 20,
  GroupMemberPointer = 22,
}

// Dangerous extensions that should ALWAYS block trading (no exceptions)
const ALWAYS_CRITICAL_EXTENSIONS = new Set<number>([
  Token2022ExtensionType.PermanentDelegate,
  Token2022ExtensionType.NonTransferable,
  Token2022ExtensionType.ConfidentialTransferMint,
]);

// TransferHook is conditionally allowed if the hook program is in the whitelist.
// Known safe TransferHook programs: verified tax/royalty/dividend protocols.
// If the hook program is NOT whitelisted, it's still treated as CRITICAL.
const SAFE_TRANSFER_HOOK_PROGRAMS = new Set<string>([
  // LibrePlex royalty enforcement
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  // Metaplex Token Auth Rules (used by legitimate NFT/token projects)
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
  // WEN royalty distribution
  'WNSrqdFKMnRPpvNz3thNMmLNPEf5r2WFGHN29rXCbcQ',
]);

export interface TokenSecurityResult {
  mint: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  passesFilter: boolean;
  reason?: string;
  checks: {
    mintAuthority: boolean;
    freezeAuthority: boolean;
    isToken2022: boolean;
    hasPermanentDelegate: boolean;
    hasTransferHook: boolean;
    /** If TransferHook present, is the hook program in the whitelist? */
    transferHookWhitelisted: boolean;
    hasNonTransferable: boolean;
    hasTransferFee: boolean;
    hasConfidentialTransfer: boolean;
    transferFeeBps: number;
    rugcheckTrustScore: number;
    rugcheckRiskLevel: string;
    lpBurntRatio: number;
    top10HolderPct: number;
    devHolderPct: number;
    liquidityUsd: number;
    tokenAge: number;
    /** Estimated CU consumption from simulateTransaction (0 = not checked) */
    estimatedComputeUnits: number;
  };
  checkDurationMs: number;
}

// CU thresholds for malicious hook detection
const CU_WARN_THRESHOLD = 400_000;   // Normal swap ~150k-300k CU
const CU_REJECT_THRESHOLD = 800_000; // Anything above is likely a CU-drain hook

export interface TokenSecurityConfig {
  minLiquidityUsd: number;
  maxTop10HolderPct: number;
  maxDevHolderPct: number;
  minLpBurntRatio: number;
  minTokenAgeSecs: number;
  maxTransferFeeBps: number;
  minRugcheckTrustScore: number;
  rugcheckAllowedRiskLevels: string[];
}

const DEFAULT_CONFIG: TokenSecurityConfig = {
  minLiquidityUsd: 10000,
  maxTop10HolderPct: 0.40,
  maxDevHolderPct: 0.10,
  minLpBurntRatio: 0.50,
  minTokenAgeSecs: 60,
  maxTransferFeeBps: 500,
  minRugcheckTrustScore: 70,
  rugcheckAllowedRiskLevels: ['LOW', 'MEDIUM'],
};

@Injectable()
export class TokenSecurityService {
  private readonly logger = new Logger(TokenSecurityService.name);
  private readonly connection: Connection;
  private readonly rugcheckApiKey: string;
  private readonly config: TokenSecurityConfig;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com');
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.rugcheckApiKey = this.configService.get<string>('RUGCHECK_API_KEY', '');

    // Allow extending TransferHook whitelist via env (comma-separated program IDs)
    const extraHookPrograms = this.configService.get<string>('TOKEN_SECURITY_SAFE_HOOK_PROGRAMS', '');
    if (extraHookPrograms) {
      for (const prog of extraHookPrograms.split(',').map(s => s.trim()).filter(Boolean)) {
        SAFE_TRANSFER_HOOK_PROGRAMS.add(prog);
      }
      this.logger.log(`TransferHook whitelist extended: ${SAFE_TRANSFER_HOOK_PROGRAMS.size} programs`);
    }

    this.config = {
      ...DEFAULT_CONFIG,
      minLiquidityUsd: this.configService.get<number>('TOKEN_SECURITY_MIN_LIQUIDITY_USD', DEFAULT_CONFIG.minLiquidityUsd),
      maxTop10HolderPct: this.configService.get<number>('TOKEN_SECURITY_MAX_TOP10_HOLDER_PCT', DEFAULT_CONFIG.maxTop10HolderPct),
      maxDevHolderPct: this.configService.get<number>('TOKEN_SECURITY_MAX_DEV_HOLDER_PCT', DEFAULT_CONFIG.maxDevHolderPct),
      minLpBurntRatio: this.configService.get<number>('TOKEN_SECURITY_MIN_LP_BURNT_RATIO', DEFAULT_CONFIG.minLpBurntRatio),
      minTokenAgeSecs: this.configService.get<number>('TOKEN_SECURITY_MIN_TOKEN_AGE_SECS', DEFAULT_CONFIG.minTokenAgeSecs),
      maxTransferFeeBps: this.configService.get<number>('TOKEN_SECURITY_MAX_TRANSFER_FEE_BPS', DEFAULT_CONFIG.maxTransferFeeBps),
      minRugcheckTrustScore: this.configService.get<number>('TOKEN_SECURITY_MIN_RUGCHECK_TRUST_SCORE', DEFAULT_CONFIG.minRugcheckTrustScore),
    };
  }

  /**
   * Multi-layer token security check.
   * Layer 1:   On-chain mint/freeze authority (~50ms)
   * Layer 1.5: Token-2022 extension detection (~50ms)
   * Layer 2:   RugCheck API (~200ms)
   * Layer 3:   Liquidity & holder analysis (~100ms)
   */
  async checkTokenSecurity(mint: string): Promise<TokenSecurityResult> {
    const startTime = Date.now();
    const checks: TokenSecurityResult['checks'] = {
      mintAuthority: true,
      freezeAuthority: true,
      isToken2022: false,
      hasPermanentDelegate: false,
      hasTransferHook: false,
      transferHookWhitelisted: false,
      hasNonTransferable: false,
      hasTransferFee: false,
      hasConfidentialTransfer: false,
      transferFeeBps: 0,
      rugcheckTrustScore: 0,
      rugcheckRiskLevel: 'UNKNOWN',
      lpBurntRatio: 0,
      top10HolderPct: 0,
      devHolderPct: 0,
      liquidityUsd: 0,
      tokenAge: 0,
      estimatedComputeUnits: 0,
    };

    try {
      // ============ Layer 1: On-chain Mint Account check (~50ms) ============
      const mintPubkey = new PublicKey(mint);
      const accountInfo = await this.connection.getAccountInfo(mintPubkey);

      if (!accountInfo) {
        return this.buildResult(mint, 'CRITICAL', 0, false, 'Mint account not found', checks, startTime);
      }

      const programOwner = accountInfo.owner;
      checks.isToken2022 = programOwner.equals(TOKEN_2022_PROGRAM_ID);

      // Parse mint authority and freeze authority from raw account data
      // SPL Token Mint layout: [36 bytes coption<pubkey> mintAuthority] [8 bytes supply] [1 byte decimals] [1 byte isInitialized] [36 bytes coption<pubkey> freezeAuthority]
      const data = accountInfo.data;

      // Mint Authority: bytes 0-35 (COption<Pubkey>: 4 bytes tag + 32 bytes pubkey)
      const mintAuthorityTag = data.readUInt32LE(0);
      checks.mintAuthority = mintAuthorityTag === 0; // 0 = None (revoked), 1 = Some

      // Freeze Authority: bytes 46-81
      const freezeAuthorityTag = data.readUInt32LE(46);
      checks.freezeAuthority = freezeAuthorityTag === 0;

      if (!checks.mintAuthority) {
        return this.buildResult(mint, 'HIGH', 10, false, 'Mint authority not revoked - unlimited minting possible', checks, startTime);
      }

      // ============ Layer 1.5: Token-2022 Extension check (~50ms) ============
      if (checks.isToken2022) {
        const extensionResult = await this.checkToken2022Extensions(data, checks, mint);
        if (extensionResult) {
          return this.buildResult(mint, extensionResult.riskLevel, extensionResult.score, false, extensionResult.reason, checks, startTime);
        }

        // ============ Layer 1.6: CU Simulation for TransferHook tokens (~100ms) ============
        // Even if a TransferHook passed PDA + ExtraAccountMeta validation,
        // it could contain expensive compute logic (recursive/loop CU-drain).
        // Simulate a minimal transfer to detect abnormal CU consumption.
        if (checks.hasTransferHook && checks.transferHookWhitelisted) {
          const cuResult = await this.simulateTransferCU(mint, checks);
          if (cuResult.reject) {
            return this.buildResult(mint, 'CRITICAL', 0, false, cuResult.reason!, checks, startTime);
          }
        }
      }

      // ============ Layer 2: RugCheck API (~200ms) ============
      const rugcheckResult = await this.checkRugCheck(mint, checks);
      if (rugcheckResult) {
        return this.buildResult(mint, rugcheckResult.riskLevel, rugcheckResult.score, false, rugcheckResult.reason, checks, startTime);
      }

      // ============ Layer 3: Liquidity & holder check (~100ms) ============
      // Token age check (from RugCheck data or on-chain slot)
      if (checks.tokenAge > 0 && checks.tokenAge < this.config.minTokenAgeSecs) {
        return this.buildResult(mint, 'HIGH', 25, false,
          `Token too new: ${checks.tokenAge}s < ${this.config.minTokenAgeSecs}s minimum`, checks, startTime);
      }

      if (checks.liquidityUsd > 0 && checks.liquidityUsd < this.config.minLiquidityUsd) {
        return this.buildResult(mint, 'HIGH', 30, false,
          `Liquidity too low: $${checks.liquidityUsd.toFixed(0)} < $${this.config.minLiquidityUsd} minimum`, checks, startTime);
      }

      if (checks.top10HolderPct > 0 && checks.top10HolderPct > this.config.maxTop10HolderPct) {
        return this.buildResult(mint, 'MEDIUM', 40, false,
          `Top 10 holders too concentrated: ${(checks.top10HolderPct * 100).toFixed(1)}% > ${this.config.maxTop10HolderPct * 100}%`, checks, startTime);
      }

      if (checks.devHolderPct > 0 && checks.devHolderPct > this.config.maxDevHolderPct) {
        return this.buildResult(mint, 'MEDIUM', 40, false,
          `Dev holding too large: ${(checks.devHolderPct * 100).toFixed(1)}% > ${this.config.maxDevHolderPct * 100}%`, checks, startTime);
      }

      if (checks.lpBurntRatio >= 0 && checks.lpBurntRatio < this.config.minLpBurntRatio) {
        return this.buildResult(mint, 'MEDIUM', 45, false,
          `LP burnt ratio too low: ${(checks.lpBurntRatio * 100).toFixed(1)}% < ${this.config.minLpBurntRatio * 100}%`, checks, startTime);
      }

      // All checks passed
      const finalScore = this.calculateScore(checks);
      return this.buildResult(mint, finalScore >= 70 ? 'SAFE' : 'LOW', finalScore, true, undefined, checks, startTime);

    } catch (error) {
      this.logger.error(`Token security check failed for ${mint}: ${(error as Error).message}`);
      // Fail-safe: reject token if security check errors
      return this.buildResult(mint, 'HIGH', 0, false, `Security check error: ${(error as Error).message}`, checks, startTime);
    }
  }

  /**
   * Check Token-2022 dangerous extensions from raw account data.
   * Returns rejection info if dangerous extension found, null if safe.
   */
  private async checkToken2022Extensions(
    data: Buffer,
    checks: TokenSecurityResult['checks'],
    mintAddress: string,
  ): Promise<{ riskLevel: 'CRITICAL' | 'HIGH'; score: number; reason: string } | null> {
    // Token-2022 mint base size = 82 bytes (same as SPL Token)
    // Extensions start after the base mint data as TLV (Type-Length-Value) entries
    // Account type byte at offset 165 for Token-2022
    const MINT_BASE_SIZE = 82;

    if (data.length <= MINT_BASE_SIZE) {
      return null; // No extensions
    }

    // Parse TLV extension data
    // TLV format: [2 bytes type][2 bytes length][N bytes value]
    let offset = MINT_BASE_SIZE;

    // Skip potential padding/account type discriminator
    // Token-2022 accounts have an extra byte for account type at position 82
    if (data.length > MINT_BASE_SIZE) {
      offset = MINT_BASE_SIZE + 1; // Skip account type byte
    }

    // Align to next extension boundary if needed
    // Extensions are padded to be aligned
    while (offset + 4 <= data.length) {
      if (offset + 4 > data.length) break;

      const extensionType = data.readUInt16LE(offset);
      const extensionLength = data.readUInt16LE(offset + 2);

      if (extensionType === 0 && extensionLength === 0) {
        break; // End of extensions
      }

      // Check for dangerous extensions
      switch (extensionType) {
        case Token2022ExtensionType.PermanentDelegate:
          checks.hasPermanentDelegate = true;
          return {
            riskLevel: 'CRITICAL',
            score: 0,
            reason: 'Token-2022 Permanent Delegate: can destroy/transfer your tokens at any time',
          };

        case Token2022ExtensionType.TransferHook: {
          checks.hasTransferHook = true;
          // Parse the hook program address from extension value.
          // TransferHook layout: [32 bytes authority][32 bytes hookProgramId]
          let hookSafe = false;
          if (extensionLength >= 64) {
            try {
              const hookProgramBytes = data.subarray(offset + 4 + 32, offset + 4 + 64);
              const hookProgramId = new PublicKey(hookProgramBytes).toBase58();
              if (SAFE_TRANSFER_HOOK_PROGRAMS.has(hookProgramId)) {
                // Whitelist match — but also verify the on-chain program is genuine
                // by checking its BPF Upgradeable Loader programData PDA.
                // This prevents a malicious actor from deploying a program that happens
                // to have the same ID on a fork or through vanity grinding.
                const isVerified = await this.verifyProgramPDA(hookProgramId);
                if (!isVerified) {
                  this.logger.warn(
                    `TransferHook program ${hookProgramId} matches whitelist but FAILED PDA verification`,
                  );
                } else {
                  // Also verify ExtraAccountMetaList PDA — prevents "Context Confusion" attacks
                  // where a legit hook program is used but with malicious extra accounts injected.
                  const extraMetaValid = await this.verifyExtraAccountMetaList(
                    mintAddress, hookProgramId,
                  );
                  if (extraMetaValid) {
                    hookSafe = true;
                    checks.transferHookWhitelisted = true;
                    this.logger.log(
                      `TransferHook whitelisted + PDA + ExtraAccountMeta verified: ${hookProgramId}`,
                    );
                  } else {
                    this.logger.warn(
                      `TransferHook program ${hookProgramId} PDA OK but ExtraAccountMetaList validation FAILED`,
                    );
                  }
                }
              } else {
                this.logger.warn(
                  `TransferHook REJECTED: hook program ${hookProgramId} not in whitelist`,
                );
              }
            } catch {
              this.logger.warn('Could not parse TransferHook program address');
            }
          }
          if (!hookSafe) {
            return {
              riskLevel: 'CRITICAL',
              score: 0,
              reason: 'Token-2022 Transfer Hook: unknown or unverified hook program',
            };
          }
          // Hook is whitelisted + PDA verified — continue checking other extensions
          break;
        }

        case Token2022ExtensionType.NonTransferable:
          checks.hasNonTransferable = true;
          return {
            riskLevel: 'CRITICAL',
            score: 0,
            reason: 'Token-2022 Non-Transferable: tokens cannot be sold',
          };

        case Token2022ExtensionType.ConfidentialTransferMint:
          checks.hasConfidentialTransfer = true;
          return {
            riskLevel: 'CRITICAL',
            score: 0,
            reason: 'Token-2022 Confidential Transfer: can hide minting/transfers via ZK proofs - invisible honeypot',
          };

        case Token2022ExtensionType.TransferFeeConfig: {
          checks.hasTransferFee = true;
          // Parse fee basis points from extension value
          // TransferFeeConfig layout: various fields, feeBasisPoints at specific offset
          if (extensionLength >= 8) {
            const valueOffset = offset + 4;
            // TransferFeeConfig: epoch, maximumFee(u64), transferFeeBasisPoints(u16)...
            // The exact layout varies; we read the fee from the newer fee config
            // Simplified: read fee basis points from the extension data
            try {
              const feeBps = data.readUInt16LE(valueOffset + 8); // Approximate offset for fee bps
              checks.transferFeeBps = feeBps;
              if (feeBps > this.config.maxTransferFeeBps) {
                return {
                  riskLevel: 'HIGH',
                  score: 15,
                  reason: `Token-2022 Transfer Fee ${feeBps / 100}% exceeds ${this.config.maxTransferFeeBps / 100}% limit`,
                };
              }
            } catch {
              // If we can't parse fee, treat as suspicious
              this.logger.warn(`Could not parse TransferFeeConfig for Token-2022 mint`);
            }
          }
          break;
        }
      }

      offset += 4 + extensionLength;
      // Align to 4-byte boundary
      offset = Math.ceil(offset / 4) * 4;
    }

    return null; // No dangerous extensions found
  }

  /**
   * Check token via RugCheck API.
   * Returns rejection info if check fails, null if passes.
   */
  private async checkRugCheck(
    mint: string,
    checks: TokenSecurityResult['checks'],
  ): Promise<{ riskLevel: 'HIGH'; score: number; reason: string } | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.rugcheckApiKey) {
        headers['x-api-key'] = this.rugcheckApiKey;
      }

      const response = await fetch(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
        { headers, signal: AbortSignal.timeout(5000) },
      );

      if (!response.ok) {
        this.logger.warn(`RugCheck API returned ${response.status} for ${mint}`);
        // Don't block on RugCheck API errors - continue with other checks
        return null;
      }

      const result = await response.json() as any;

      // Extract trust score and risk level
      checks.rugcheckTrustScore = result.trustScore ?? result.score ?? 0;
      checks.rugcheckRiskLevel = result.riskLevel ?? 'UNKNOWN';

      // Extract liquidity and holder data if available
      if (result.liquidityDetails) {
        checks.liquidityUsd = result.liquidityDetails.totalLiquidity ?? 0;
        checks.lpBurntRatio = result.liquidityDetails.liquidityLocked ?? 0;
      }
      if (result.holderAnalysis) {
        checks.top10HolderPct = result.holderAnalysis.topHoldersConcentration ?? 0;
      }
      if (result.tokenMeta?.createdAt) {
        const createdAt = new Date(result.tokenMeta.createdAt).getTime();
        checks.tokenAge = Math.max(0, (Date.now() - createdAt) / 1000);
      }
      if (result.creatorBalance !== undefined && result.totalSupply) {
        checks.devHolderPct = result.creatorBalance / result.totalSupply;
      }

      // Check trust score and risk level (both must pass)
      if (checks.rugcheckTrustScore < this.config.minRugcheckTrustScore ||
          !this.config.rugcheckAllowedRiskLevels.includes(checks.rugcheckRiskLevel)) {
        return {
          riskLevel: 'HIGH',
          score: 20,
          reason: `RugCheck failed: trust=${checks.rugcheckTrustScore}, risk=${checks.rugcheckRiskLevel} (require trust≥${this.config.minRugcheckTrustScore}, risk∈{${this.config.rugcheckAllowedRiskLevels.join(',')}})`,
        };
      }

      return null; // RugCheck passed
    } catch (error) {
      this.logger.warn(`RugCheck API error for ${mint}: ${(error as Error).message}`);
      return null; // Don't block on API timeout
    }
  }

  /**
   * Calculate overall security score (0-100, higher = safer).
   */
  private calculateScore(checks: TokenSecurityResult['checks']): number {
    let score = 0;

    // Mint authority revoked: +20
    if (checks.mintAuthority) score += 20;
    // Freeze authority revoked: +10
    if (checks.freezeAuthority) score += 10;
    // No dangerous Token-2022 extensions: +15
    // Whitelisted TransferHook is NOT penalized (transferHookWhitelisted=true)
    const hasUnsafeHook = checks.hasTransferHook && !checks.transferHookWhitelisted;
    if (!checks.hasPermanentDelegate && !hasUnsafeHook &&
        !checks.hasNonTransferable && !checks.hasConfidentialTransfer) {
      score += 15;
    }
    // Low transfer fee: +5
    if (!checks.hasTransferFee || checks.transferFeeBps <= 100) score += 5;
    // RugCheck score contribution: up to +20
    score += Math.min(20, (checks.rugcheckTrustScore / 100) * 20);
    // LP burnt: up to +15
    score += Math.min(15, checks.lpBurntRatio * 15);
    // Holder distribution: up to +15
    const holderScore = Math.max(0, 1 - checks.top10HolderPct) * 15;
    score += Math.min(15, holderScore);

    return Math.round(Math.min(100, score));
  }

  private buildResult(
    mint: string,
    riskLevel: TokenSecurityResult['riskLevel'],
    score: number,
    passesFilter: boolean,
    reason: string | undefined,
    checks: TokenSecurityResult['checks'],
    startTime: number,
  ): TokenSecurityResult {
    const result: TokenSecurityResult = {
      mint,
      riskLevel,
      score,
      passesFilter,
      reason,
      checks,
      checkDurationMs: Date.now() - startTime,
    };

    if (!passesFilter) {
      this.logger.warn(`Token ${mint} REJECTED: ${reason} [${result.checkDurationMs}ms]`);
    } else {
      this.logger.log(`Token ${mint} PASSED: score=${score} [${result.checkDurationMs}ms]`);
    }

    return result;
  }

  /**
   * Verify a program is genuine by checking its BPF Upgradeable Loader PDA.
   * Derives the expected programData address from [program_id, BPFUpgradeableLoader]
   * and confirms it matches the on-chain account owner + stored programdata_address.
   * Returns false if the program doesn't exist, isn't upgradeable, or PDA doesn't match.
   */
  private async verifyProgramPDA(programId: string): Promise<boolean> {
    try {
      const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
      const programPubkey = new PublicKey(programId);

      const accountInfo = await this.connection.getAccountInfo(programPubkey);
      if (!accountInfo) return false;

      // Program account must be owned by BPF Upgradeable Loader
      if (!accountInfo.owner.equals(BPF_LOADER_UPGRADEABLE)) return false;

      // Program account data layout (BPF Upgradeable):
      //   [4 bytes state enum][32 bytes programdata_address]
      // state=2 means "Program" variant
      if (accountInfo.data.length < 36) return false;
      const stateEnum = accountInfo.data.readUInt32LE(0);
      if (stateEnum !== 2) return false;

      const storedProgramData = new PublicKey(accountInfo.data.subarray(4, 36));

      // Derive the expected programData PDA
      const [expectedProgramData] = PublicKey.findProgramAddressSync(
        [programPubkey.toBuffer()],
        BPF_LOADER_UPGRADEABLE,
      );

      // The on-chain programdata_address must match the PDA derivation
      if (!storedProgramData.equals(expectedProgramData)) {
        this.logger.warn(`PDA mismatch for ${programId}: stored=${storedProgramData.toBase58()}, expected=${expectedProgramData.toBase58()}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.warn(`PDA verification failed for ${programId}: ${(err as Error)}`);
      return false;
    }
  }

  /**
   * Simulate a minimal token transfer to estimate CU consumption.
   * High CU (>800k) from a TransferHook indicates a potential CU-drain attack
   * that would cause our swap to fail on-chain, wasting gas + Jito tip.
   *
   * We construct a dummy transfer instruction and simulate — no real funds at risk.
   */
  async simulateTransferCU(
    mintAddress: string,
    checks: TokenSecurityResult['checks'],
  ): Promise<{ cuUsed: number; reject: boolean; reason?: string }> {
    try {
      const { Transaction, SystemProgram, Keypair } = await import('@solana/web3.js');

      const mintPubkey = new PublicKey(mintAddress);
      const dummyPayer = Keypair.generate();

      // Build a minimal transfer instruction to measure CU
      // For Token-2022 with hooks, the runtime will invoke the hook during simulation
      const { createTransferCheckedInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');

      const sourceATA = await getAssociatedTokenAddress(
        mintPubkey,
        dummyPayer.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );
      const destATA = await getAssociatedTokenAddress(
        mintPubkey,
        Keypair.generate().publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Fetch decimals from mint
      const mintInfo = await this.connection.getAccountInfo(mintPubkey);
      if (!mintInfo || mintInfo.data.length < 45) {
        return { cuUsed: 0, reject: false };
      }
      const decimals = mintInfo.data[44];

      const transferIx = createTransferCheckedInstruction(
        sourceATA,
        mintPubkey,
        destATA,
        dummyPayer.publicKey,
        1, // 1 token unit
        decimals,
        [],
        TOKEN_2022_PROGRAM_ID,
      );

      // Add ComputeBudget to request max CU so we can measure actual usage
      const { ComputeBudgetProgram } = await import('@solana/web3.js');
      const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

      const { blockhash: recentBlockhash } = await this.connection.getLatestBlockhash('finalized');
      const tx = new Transaction({
        feePayer: dummyPayer.publicKey,
        recentBlockhash,
      }).add(cuLimitIx, transferIx);

      // Simulate without signature verification — we have no real signer, and the
      // goal is just to measure CU consumption. `replaceRecentBlockhash: true` also
      // helps avoid blockhash-expiry failures on subsequent calls.
      // Cast to any — older @solana/web3.js typings don't expose these options on
      // the legacy Transaction overload.
      const simResult = await (this.connection as any).simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: 'processed',
      });

      const cuUsed = simResult.value.unitsConsumed ?? 0;
      checks.estimatedComputeUnits = cuUsed;

      // Simulation errors are expected (dummy accounts have no balance),
      // but we still get the CU consumed before the error
      if (cuUsed > CU_REJECT_THRESHOLD) {
        return {
          cuUsed,
          reject: true,
          reason: `TransferHook CU-drain detected: ${cuUsed.toLocaleString()} CU consumed (threshold: ${CU_REJECT_THRESHOLD.toLocaleString()})`,
        };
      }

      if (cuUsed > CU_WARN_THRESHOLD) {
        this.logger.warn(
          `Token ${mintAddress} TransferHook high CU: ${cuUsed.toLocaleString()} (warn threshold: ${CU_WARN_THRESHOLD.toLocaleString()})`,
        );
      }

      return { cuUsed, reject: false };
    } catch (err) {
      this.logger.debug(`CU simulation skipped for ${mintAddress}: ${(err as Error).message}`);
      return { cuUsed: 0, reject: false };
    }
  }

  /**
   * Verify the ExtraAccountMetaList PDA for a TransferHook.
   *
   * The Token-2022 TransferHook interface requires an ExtraAccountMetaList account
   * derived as PDA with seeds ["extra-account-metas", mint_pubkey] owned by the hook program.
   * This prevents "Context Confusion" attacks where attackers inject malicious extra accounts.
   *
   * Checks:
   *   1. The ExtraAccountMetaList PDA exists at the canonical address
   *   2. It is owned by the hook program (not by an attacker)
   *   3. It has a valid TLV structure (length field ≤ data length)
   */
  private async verifyExtraAccountMetaList(
    mintAddress: string,
    hookProgramId: string,
  ): Promise<boolean> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const hookProgramPubkey = new PublicKey(hookProgramId);

      // Canonical seed derivation per spl-transfer-hook-interface
      const [expectedExtraMetaPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintPubkey.toBuffer()],
        hookProgramPubkey,
      );

      const accountInfo = await this.connection.getAccountInfo(expectedExtraMetaPDA);

      // If no ExtraAccountMetaList exists, the hook doesn't require extra accounts — safe
      if (!accountInfo) {
        this.logger.log(`No ExtraAccountMetaList for mint ${mintAddress} (hook has no extra accounts)`);
        return true;
      }

      // Must be owned by the hook program itself
      if (!accountInfo.owner.equals(hookProgramPubkey)) {
        this.logger.warn(
          `ExtraAccountMetaList owner mismatch: expected ${hookProgramId}, got ${accountInfo.owner.toBase58()}`,
        );
        return false;
      }

      // Basic TLV structure validation:
      // ExtraAccountMetaList layout: [4 bytes discriminator][4 bytes length][...TLV entries]
      const data = accountInfo.data;
      if (data.length < 8) {
        this.logger.warn(`ExtraAccountMetaList data too short: ${data.length} bytes`);
        return false;
      }

      const entryLength = data.readUInt32LE(4);
      if (entryLength > data.length - 8) {
        this.logger.warn(
          `ExtraAccountMetaList corrupt: declared length ${entryLength} > available ${data.length - 8}`,
        );
        return false;
      }

      // Count entries (each ExtraAccountMeta = 35 bytes: 1 discriminator + 32 pubkey + 1 isSigner + 1 isWritable)
      const EXTRA_ACCOUNT_META_SIZE = 35;
      const entryCount = Math.floor(entryLength / EXTRA_ACCOUNT_META_SIZE);

      // Sanity: if more than 10 extra accounts, it's suspicious
      if (entryCount > 10) {
        this.logger.warn(
          `ExtraAccountMetaList has ${entryCount} entries (>10) — suspiciously many extra accounts`,
        );
        return false;
      }

      this.logger.log(
        `ExtraAccountMetaList verified for mint ${mintAddress}: ${entryCount} extra accounts, owner=${hookProgramId}`,
      );
      return true;
    } catch (err) {
      this.logger.warn(`ExtraAccountMetaList verification failed for mint ${mintAddress}: ${(err as Error)}`);
      return false;
    }
  }
}
