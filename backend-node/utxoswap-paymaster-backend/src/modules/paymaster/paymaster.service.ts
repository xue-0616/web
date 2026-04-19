import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { CKBScript, CkbCellInputDto } from './dtos/ckb-cell.input.dto';
import { CkbCellOutputDto } from './dtos/ckb-cell.output';
import { CandidateCellManagerService } from './candidate-cell-manager.service';
import { LiquidityPoolService } from './liquidity-pool.service';
import { Collector, append0x, getXudtTypeScript } from '@rgbpp-sdk/ckb';
import {
  AddressPrefix,
  addressToScript,
  privateKeyToAddress,
  scriptToAddress,
} from '@nervosnetwork/ckb-sdk-utils';
import { SWAP_INTENT_CELL_CAPACITY } from '../../common/utils/swap-utils';
import { MyCustomException, MyErrorCode } from '../../filters/custom.exception';

@Injectable()
export class PaymasterService {
  private readonly _collector: Collector;
  private readonly _providerCkbAddress: string;
  private readonly _candidateCellCapacity: bigint;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly appConfig: AppConfigService,
    private readonly cellService: CandidateCellManagerService,
    private readonly poolService: LiquidityPoolService,
  ) {
    this.logger.setContext(PaymasterService.name);
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
    this._candidateCellCapacity = BigInt(
      this.appConfig.cellManagerConfig.candidateCellCapacity,
    );
  }

  async getUDTQuota(input: CKBScript): Promise<string> {
    const udtAmount = await this.poolService.estimateAmountIn(
      this._candidateCellCapacity - SWAP_INTENT_CELL_CAPACITY,
      input,
    );
    return append0x(udtAmount.toString(16));
  }

  async getCkbCell(input: CkbCellInputDto): Promise<CkbCellOutputDto> {
    const { address, assetType } = input;
    const lock = addressToScript(address);

    const outputDto = await this.cellService.getCandidateCellFromCache(lock);
    if (outputDto !== null) return outputDto;

    await this.validateCkbCellInput(input);

    const paymasterLock = addressToScript(this._providerCkbAddress);
    const { intentCell, udtAmount } =
      await this.poolService.generateSwapIntentUDTCellForPaymaster(
        this._candidateCellCapacity - SWAP_INTENT_CELL_CAPACITY,
        paymasterLock,
        assetType,
      );

    const candidateCell = await this.cellService.popCandidateCell();

    const ret: CkbCellOutputDto = {
      // The SDK's IndexerCell has `output.type: Script | null | undefined`
      // while the DTO's CKBIndexerCell has `CKBScript | undefined`; the
      // runtime shapes are identical, this cast acknowledges the
      // declarative-only difference.
      ckbInputCell: candidateCell as unknown as CkbCellOutputDto['ckbInputCell'],
      paymasterIntentUDTCellForSwap: intentCell,
      udtAmount: append0x(udtAmount.toString(16)),
    };

    try {
      await this.cellService.saveCandidateCellToCache(lock, ret, 60);
    } catch (e) {
      // BUG-11 fix: Return cell to pool if cache save fails, preventing cell depletion
      this.logger.error(`[getCkbCell] saveCandidateCellToCache failed, returning cell to pool: ${e}`);
      await this.cellService.pushCandidateCells([candidateCell]);
      throw e;
    }

    return ret;
  }

  async validateCkbCellInput(input: CkbCellInputDto): Promise<void> {
    const { address, assetType, intentArgs } = input;
    this.logger.log(`address = ${address}`);

    const lock = addressToScript(address);
    const userCell = await this.cellService.collectCell(
      scriptToAddress(lock, !this.appConfig.isTestnet),
    );

    const totalCapacity = userCell
      .map((x) => BigInt(x.output.capacity))
      .reduce((prev, cur) => prev + cur, BigInt(0));

    // BUG-15 fix: Raise threshold from 500 CKB to 50,000 CKB so more legitimate users can use the paymaster
    if (totalCapacity > BigInt(50000) * BigInt(10 ** 8)) {
      throw new MyCustomException(
        'Balance is sufficient, paymaster is unnecessary',
        MyErrorCode.AddressNotQualified,
      );
    }

    this.checkAssetScript(assetType);

    const xudtCells = await this._collector.getCells({
      lock: lock,
      type: assetType as any,
    });

    if (xudtCells.length === 0) {
      throw new MyCustomException(
        'User has no xudt',
        MyErrorCode.AddressNotQualified,
      );
    }
  }

  checkAssetScript(assetType: CKBScript): void {
    const ccBtcScript = !this.appConfig.isTestnet
      ? {
          codeHash:
            '0x092c2c4a26ea475a8e860c29cf00502103add677705e2ccd8d6fe5af3caa5ae3',
          args: '0x68e64ba4b0daeeec45c1f983d6d574fca370442cafb805bc4265ef74870a4ac8',
          hashType: 'type',
        }
      : {
          codeHash:
            '0x98701eaf939113606a8a70013fd2e8f27b8f1e234acdc329f3d71f9e9d3d3233',
          args: '0x3b6224e621410370887db7e3d95f63d9c760d7f56ee864521403c99e8b4f34b8',
          hashType: 'type',
        };
    const xudtScript = getXudtTypeScript(!this.appConfig.isTestnet);

    if (
      !assetType ||
      ![ccBtcScript, xudtScript]
        .map((x) => x.codeHash)
        .includes(assetType.codeHash)
    ) {
      throw new MyCustomException(
        'Not valid xudt asset',
        MyErrorCode.AssetIsNotSupport,
      );
    }
  }
}
