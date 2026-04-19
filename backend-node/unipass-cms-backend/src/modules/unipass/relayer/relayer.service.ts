import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interface, formatUnits, toBeHex } from 'ethers';
import { DataSource } from 'typeorm';
import { erc20, gasEstimator, moduleGuest, moduleHookEIP4337Wallet, moduleMain, moduleMainGasEstimator, moduleMainUpgradable, multiCall, singletonFactory } from '@unipasswallet/abi';
import { ModuleMainInterface } from '@unipasswallet/utils';
import { LoggerService } from '../../../shared/logger/logger.service';
import { ITransaction, RelayerTransactionEntity } from '../../../entities/relayer/relaye.transactions.entity';
import { NATIVE_TOKEN_ADDRESS, getUnipassWalletContext, nativeToken } from '../chain/utils';
import { paseSelfExecute } from '../payment_snap/utils/transaction.utils';

type FeeIncomeResult = {
  feeIncome: string;
  feeToken: string;
};

@Injectable()
export class RelayerService {
  private readonly dataSource: DataSource;
  private readonly walletDataSource: DataSource;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const relayerData = this.configService.get('relayer_database');
    this.dataSource = new DataSource({ ...relayerData, name: 'Relayer_db' });
    void this.dataSource.initialize().catch((error) => {
      this.logger.error(`[RelayerService] init relayer db failed: ${(error as Error).message}`);
    });

    const walletData = this.configService.get('unipass_database');
    this.walletDataSource = new DataSource({
      ...walletData,
      name: 'UniPass_db',
    });
    void this.walletDataSource.initialize().catch((error) => {
      this.logger.error(`[RelayerService] init wallet db failed: ${(error as Error).message}`);
    });
  }

  async getApTransactionInfo(chainTxHash: string): Promise<FeeIncomeResult | null> {
    const manager = this.walletDataSource.manager;
    const sql = `select action_point as AP from user_action_point_transactions where chain_tx_hash = x'${chainTxHash.replace('0x', '')}'`;
    const apInfo = await manager.query(sql);
    if (apInfo.length > 0) {
      return { feeIncome: apInfo[0].AP, feeToken: 'AP' };
    }
    return null;
  }

  paseTransaction(tx: RelayerTransactionEntity): FeeIncomeResult {
    const { to = '', data = '0x' } = tx.transaction ?? {};
    const moduleGuestAddress = getUnipassWalletContext().moduleGuest;
    if (to.toLowerCase() === moduleGuestAddress.toLowerCase()) {
      return this.paseModuleGuestTransaction(data, tx.chainId);
    }
    return this.paseModuleMainTransaction(data, tx.chainId);
  }

  paseModuleGuestTransaction(data: string, chainId: string): FeeIncomeResult {
    const ret: any = ModuleMainInterface.decodeFunctionData('execute', data);
    const feeCallTx = ret._txs[ret._txs.length - 1];
    const feeTx: any = ModuleMainInterface.decodeFunctionData('execute', feeCallTx.data);
    const innerFeeTx = feeTx._txs[feeTx._txs.length - 1];
    return this.getFeeIncome(innerFeeTx, chainId);
  }

  paseModuleMainTransaction(data: string, chainId: string): FeeIncomeResult {
    const ret: any = ModuleMainInterface.decodeFunctionData('execute', data);
    const innerFeeTx = ret._txs[ret._txs.length - 1];
    return this.getFeeIncome(innerFeeTx, chainId);
  }

  getFeeIncome(innerFeeTx: any, chainId: string): FeeIncomeResult {
    let feeIncome = formatUnits(0n, 'ether');
    let feeToken = NATIVE_TOKEN_ADDRESS;
    const tokenInfo = nativeToken[chainId];

    if (innerFeeTx.data === '0x') {
      const { value } = innerFeeTx;
      const decimals = tokenInfo?.[NATIVE_TOKEN_ADDRESS]?.decimals ?? 'ether';
      feeIncome = formatUnits(toBeHex(value), decimals);
      return { feeIncome, feeToken };
    }

    const parsedInnerFeeTx = paseSelfExecute(innerFeeTx as ITransaction & { target?: string });
    const contractInterface = new Interface(erc20.abi);
    const ret: any = contractInterface.decodeFunctionData('transfer', parsedInnerFeeTx.data);
    feeToken = parsedInnerFeeTx.target ?? NATIVE_TOKEN_ADDRESS;
    const decimals = tokenInfo?.[feeToken]?.decimals ?? 'ether';
    feeIncome = formatUnits(toBeHex(ret.amount), decimals);
    return { feeIncome, feeToken };
  }

  paseInteractWith(tx: ITransaction): { interactWithAddress?: string; functionAbi: string; moduleGuestAddress: string } {
    const { to, data = '0x' } = tx;
    const interactWithAddress = to;
    const moduleGuestAddress = getUnipassWalletContext(true).moduleGuest;
    const ret: any = ModuleMainInterface.decodeFunctionData('execute', data);
    let methods = this.getDataMethod(ret, [], 'execute');
    if (methods[methods.length - 1] === '0x') {
      methods[methods.length - 1] = 'transfer_nativegas';
    } else if (methods[methods.length - 1] === '0xa9059cbb') {
      methods[methods.length - 1] = 'transfer_erc20gas';
    }
    methods = this.getFunctionAbi(methods);
    return {
      interactWithAddress,
      functionAbi: `execute(${methods})`,
      moduleGuestAddress,
    };
  }

  getDataMethod(ret: any, functionName: string[], method: string): string[] {
    for (const item of ret._txs) {
      const itemFunctionName = item.data.slice(0, 10);
      if (itemFunctionName === functionName[0]) {
        const innerTx: any = ModuleMainInterface.decodeFunctionData(method, item.data);
        return this.getDataMethod(innerTx, functionName, method);
      }
      functionName.push(itemFunctionName);
    }
    return functionName;
  }

  getFunctionAbi(methodName: string[]): string[] {
    const methodIdMap = new Map<string, string>();
    const abi = [
      ...moduleGuest.abi,
      ...moduleMain.abi,
      ...moduleMainUpgradable.abi,
      ...erc20.abi,
      ...multiCall.abi,
      ...singletonFactory.abi,
      ...moduleMainGasEstimator.abi,
      ...moduleHookEIP4337Wallet.abi,
      ...gasEstimator.abi,
    ];
    for (const item of abi as any[]) {
      if (item.type !== 'function') {
        continue;
      }
      const functionSignature = new Interface([item]).getFunction(item.name)?.selector ?? '';
      methodIdMap.set(functionSignature, item.name);
    }
    return methodName.map((item) => methodIdMap.get(item) ?? item);
  }
}
