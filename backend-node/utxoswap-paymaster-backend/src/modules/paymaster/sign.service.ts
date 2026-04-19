import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { PaymasterSigInputDto } from './dtos/paymaster-sig.input.dto';
import { PaymasterSigOutputDto } from './dtos/paymaster-sig.output';
import { CandidateCellManagerService } from './candidate-cell-manager.service';
import { CkbCellOutputDto } from './dtos/ckb-cell.output';
import { Collector, leToU128 } from '@rgbpp-sdk/ckb';
import {
  AddressPrefix,
  addressToScript,
  privateKeyToAddress,
  rawTransactionToHash,
  scriptToHash,
  serializeWitnessArgs,
} from '@nervosnetwork/ckb-sdk-utils';
import { filterCellsByInputs } from '@nervosnetwork/ckb-sdk-core/lib/utils';
import signWitnesses from '@nervosnetwork/ckb-sdk-core/lib/signWitnesses';
import { MyCustomException, MyErrorCode } from '../../filters/custom.exception';

/** Maximum number of signing requests per API key per day */
const DAILY_SIGNING_LIMIT = 1000;
const DAILY_SIGNING_TTL_SECONDS = 86400; // 24 hours
/** Maximum allowed inputs in a transaction to prevent abuse */
const MAX_TRANSACTION_INPUTS = 100;
/** Maximum allowed outputs in a transaction */
const MAX_TRANSACTION_OUTPUTS = 100;

@Injectable()
export class SignService {
  private readonly _collector: Collector;
  private readonly _providerCkbAddress: string;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly appConfig: AppConfigService,
    private readonly cellService: CandidateCellManagerService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.logger.setContext(SignService.name);
    this._collector = new Collector({
      ckbNodeUrl: this.appConfig.cellManagerConfig.ckbNodeUrl,
      ckbIndexerUrl: this.appConfig.cellManagerConfig.ckbIndexerUrl,
    });
    this._providerCkbAddress = privateKeyToAddress(
      this.appConfig.cellManagerConfig.cellManagerKey,
      {
        prefix: !this.appConfig.isTestnet
          ? AddressPrefix.Mainnet
          : AddressPrefix.Testnet,
      },
    );
  }

  /**
   * Check and increment daily signing counter for an API key.
   * BUG-18 fix: Uses Lua script for atomic INCR+EXPIRE to prevent key persisting forever
   * if process crashes between INCR and EXPIRE.
   */
  private async checkDailySigningLimit(apiKeyHashPrefix: string): Promise<void> {
    const redisKey = `paymaster:daily_sign_count:${apiKeyHashPrefix}`;

    // Atomic Lua script: INCR the key and set TTL only if the key is new (TTL == -1)
    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if redis.call('TTL', KEYS[1]) == -1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;
    const currentCount = await this.redis.eval(
      luaScript, 1, redisKey, DAILY_SIGNING_TTL_SECONDS,
    ) as number;

    if (currentCount > DAILY_SIGNING_LIMIT) {
      this.logger.warn(
        `Daily signing limit exceeded for API key (hash prefix: ${apiKeyHashPrefix}): ${currentCount}/${DAILY_SIGNING_LIMIT}`,
      );
      throw new MyCustomException(
        `Daily signing limit exceeded (${DAILY_SIGNING_LIMIT} per day). Try again tomorrow.`,
        MyErrorCode.RateLimitExceeded,
      );
    }
  }

  /**
   * Validate the basic structure of the transaction before signing.
   */
  private validateTransactionStructure(paymasterSigInputDto: PaymasterSigInputDto): void {
    const { transaction, address } = paymasterSigInputDto;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      throw new MyCustomException(
        'Invalid address',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (!transaction) {
      throw new MyCustomException(
        'Transaction is required',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (!transaction.inputs || transaction.inputs.length === 0) {
      throw new MyCustomException(
        'Transaction must have at least one input',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (transaction.inputs.length > MAX_TRANSACTION_INPUTS) {
      throw new MyCustomException(
        `Transaction has too many inputs (max: ${MAX_TRANSACTION_INPUTS})`,
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (!transaction.outputs || transaction.outputs.length === 0) {
      throw new MyCustomException(
        'Transaction must have at least one output',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (transaction.outputs.length > MAX_TRANSACTION_OUTPUTS) {
      throw new MyCustomException(
        `Transaction has too many outputs (max: ${MAX_TRANSACTION_OUTPUTS})`,
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (
      !transaction.outputsData ||
      transaction.outputsData.length !== transaction.outputs.length
    ) {
      throw new MyCustomException(
        'outputsData length must match outputs length',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    if (!transaction.version) {
      throw new MyCustomException(
        'Transaction version is required',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    // Validate witnesses array exists
    if (!transaction.witnesses || !Array.isArray(transaction.witnesses)) {
      throw new MyCustomException(
        'Transaction witnesses must be an array',
        MyErrorCode.TransactionValidationFailed,
      );
    }
  }

  async validatePaymasterIntentInTransaction(
    paymasterSigInputDto: PaymasterSigInputDto,
    cells: any[],
    cachedCell: CkbCellOutputDto,
  ): Promise<void> {
    const providerLockHash = scriptToHash(
      addressToScript(this._providerCkbAddress),
    );
    const { address, transaction } = paymasterSigInputDto;
    const lock = addressToScript(address);
    const paymasterIntentLockHash = scriptToHash(
      cachedCell.paymasterIntentUDTCellForSwap.lock as any,
    );
    const paymasterIntentTypeHash = scriptToHash(
      cachedCell.paymasterIntentUDTCellForSwap.type as any,
    );
    const paymasterUdtAmount = BigInt(cachedCell.udtAmount);

    const paymasterInputIndexes: number[] = [];
    cells.forEach((x, _index) => {
      if (scriptToHash(x.lock) === providerLockHash) {
        paymasterInputIndexes.push(_index);
      }
    });

    if (paymasterInputIndexes.length !== 1) {
      this.logger.log(
        `paymasterInputIndexes.length = ${paymasterInputIndexes.length}`,
      );
      throw new MyCustomException(
        'Paymaster provide more than 1 input',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    // BUG-13 fix: Verify CKB capacity conservation — total input capacity must >= total output capacity
    // This prevents a malicious user from draining paymaster CKB capacity via crafted transactions.
    let totalInputCapacity = BigInt(0);
    for (let i = 0; i < transaction.inputs.length; i++) {
      const liveCell = await this._collector.getLiveCell(transaction.inputs[i].previousOutput);
      if (liveCell) {
        totalInputCapacity += BigInt(liveCell.output.capacity);
      }
    }
    const totalOutputCapacity = transaction.outputs.reduce(
      (sum: bigint, output: any) => sum + BigInt(output.capacity),
      BigInt(0),
    );
    if (totalInputCapacity < totalOutputCapacity) {
      throw new MyCustomException(
        `Capacity conservation violated: input capacity (${totalInputCapacity}) < output capacity (${totalOutputCapacity})`,
        MyErrorCode.TransactionValidationFailed,
      );
    }

    // Additionally verify paymaster's input capacity is returned in outputs
    const paymasterInputIndex = paymasterInputIndexes[0];
    const paymasterInputCell = await this._collector.getLiveCell(
      transaction.inputs[paymasterInputIndex].previousOutput,
    );
    const paymasterInputCapacity = BigInt(paymasterInputCell.output.capacity);

    // Sum capacity of outputs going back to the paymaster (provider lock) or to the intent lock
    let paymasterRelatedOutputCapacity = BigInt(0);
    for (const output of transaction.outputs) {
      const outputLockHash = scriptToHash(output.lock as any);
      if (outputLockHash === providerLockHash || outputLockHash === paymasterIntentLockHash) {
        paymasterRelatedOutputCapacity += BigInt(output.capacity);
      }
    }

    if (paymasterRelatedOutputCapacity < paymasterInputCapacity) {
      throw new MyCustomException(
        `Paymaster capacity drain detected: paymaster input capacity (${paymasterInputCapacity}) > paymaster-related output capacity (${paymasterRelatedOutputCapacity})`,
        MyErrorCode.TransactionValidationFailed,
      );
    }

    const paymasterIntentOutputIndex = transaction.outputs.findIndex(
      (x) =>
        scriptToHash(x.lock as any) === paymasterIntentLockHash &&
        scriptToHash(x.type as any) === paymasterIntentTypeHash,
    );

    if (paymasterIntentOutputIndex === -1) {
      throw new MyCustomException(
        'No Paymaster intent output',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    const udtAmountFromIntentTx = leToU128(
      transaction.outputsData[paymasterIntentOutputIndex],
    );

    if (paymasterUdtAmount !== udtAmountFromIntentTx) {
      throw new MyCustomException(
        `udt amount in tx ${udtAmountFromIntentTx} != paymaster intent udt amount ${paymasterUdtAmount}. `,
        MyErrorCode.TransactionValidationFailed,
      );
    }
  }

  async signPaymasterInput(
    paymasterSigInputDto: PaymasterSigInputDto,
    callerIp: string = 'unknown',
    apiKeyHashPrefix: string = 'unknown',
  ): Promise<PaymasterSigOutputDto> {
    // Audit log: record signing attempt
    this.logger.log(
      `[signPaymasterInput] Signing request from IP: ${callerIp}, API key hash prefix: ${apiKeyHashPrefix}, address: ${paymasterSigInputDto.address}`,
    );

    // Check daily signing limit for this API key
    await this.checkDailySigningLimit(apiKeyHashPrefix);

    // Validate transaction structure before doing any expensive operations
    this.validateTransactionStructure(paymasterSigInputDto);

    const { transaction, address } = paymasterSigInputDto;
    const lock = addressToScript(address);
    const cells: any[] = [];

    for (let i = 0; i < transaction.inputs.length; i++) {
      const input = transaction.inputs[i];
      const cell = await this._collector.getLiveCell(input.previousOutput);
      if (!cell) {
        throw new MyCustomException(
          `Transaction Inputs[${i}] is not alive `,
          MyErrorCode.TransactionValidationFailed,
        );
      }
      cells.push({
        outPoint: input.previousOutput,
        lock: cell.output.lock,
      });
    }

    const cachedCell = await this.cellService.getCandidateCellFromCache(lock);
    if (cachedCell === null) {
      throw new MyCustomException(
        'no candidate cell applied',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    await this.validatePaymasterIntentInTransaction(
      paymasterSigInputDto,
      cells,
      cachedCell,
    );

    // BUG-12 fix: Prevent same cell from being signed for different transactions (double-signing).
    // Use a Redis lock key per cell outpoint to ensure only one signing operation proceeds.
    const cellOutPoint = cachedCell.ckbInputCell.outPoint;
    const signLockKey = `paymaster:sign_lock:${cellOutPoint.txHash}_${cellOutPoint.index}`;
    const alreadySigned = await this.redis.set(signLockKey, '1', 'EX', 300, 'NX');
    if (!alreadySigned) {
      throw new MyCustomException(
        'This candidate cell has already been signed for a transaction. Please request a new cell.',
        MyErrorCode.TransactionValidationFailed,
      );
    }

    const providerLockHash = scriptToHash(
      addressToScript(this._providerCkbAddress),
    );
    const emptyWitness = { lock: '', inputType: '', outputType: '' };
    const paymasterInputIndex = cells.findIndex(
      (x) => scriptToHash(x.lock) === providerLockHash,
    );

    this.logger.log(
      `[signPaymasterInput] paymasterInputIndex: ${paymasterInputIndex}`,
    );

    const witnesses = transaction.witnesses;
    witnesses[paymasterInputIndex] = emptyWitness;

    const unsignedTx = {
      ...transaction,
      witnesses,
    };

    const keyMap = new Map<string, string>();
    keyMap.set(
      providerLockHash,
      this.appConfig.cellManagerConfig.cellManagerKey,
    );

    const transactionHash = rawTransactionToHash(unsignedTx as any);
    const inputCells = filterCellsByInputs(cells, unsignedTx.inputs);

    const ret = signWitnesses(keyMap)({
      transactionHash,
      witnesses: unsignedTx.witnesses as any,
      inputCells,
      skipMissingKeys: true,
    });

    const signedTx = {
      ...unsignedTx,
      witnesses: ret.map((witness) =>
        typeof witness === 'string'
          ? witness
          : serializeWitnessArgs(witness),
      ),
    };

    // Audit log: record successful signing (don't log the full tx for security)
    this.logger.log(
      `[signPaymasterInput] Successfully signed transaction for address: ${address}, IP: ${callerIp}, API key hash prefix: ${apiKeyHashPrefix}`,
    );

    await this.cellService.saveCandidateCellToCache(lock, cachedCell, 60 * 5);

    return {
      signedTransaction: signedTx,
      sig: (ret[paymasterInputIndex] as any).lock,
    };
  }
}
