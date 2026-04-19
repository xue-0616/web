import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ConfigurationKeyPaths } from '@/config/configuration';
import { ApiConfigService } from '../../../../shared/services/api-config.service';
import { CustomTxFee, DeployInfo, PaymentAccount, getPaymentTransactionList } from '../utils/interface';
import { RelayerTransactionEntity, TxStatus } from '../../../../entities/relayer/relaye.transactions.entity';
import { LoggerService } from '../../../../shared/logger/logger.service';
import { getCustomDiscount } from '../utils/payment-snap-gas.utils';
import { parsePaymentData } from '../utils/payment-tx.utils';
import { getChainName } from '../../chain/utils';

@Injectable()
export class SnapAppDbService {
    configService;
    apiConfigService;
    logger;
    dataSource!: any;
    customAutDataSource!: any;
    snapDataSource!: any;
    paymentDataSource!: any;
    defaultDataSource!: any;
    constructor(configService: ConfigService<ConfigurationKeyPaths>, apiConfigService: ApiConfigService, logger: LoggerService) {
        this.configService = configService;
        this.apiConfigService = apiConfigService;
        this.logger = logger;
        this.initDataSource();
    }
    initDataSource(): DataSource {
        const relayerData = this.configService.get('relayer_database' as any);
        this.dataSource = new DataSource({ ...relayerData, name: 'Relayer_db' });
        this.dataSource.initialize();
        const customAuthData = this.configService.get('custom_auth_database' as any);
        this.customAutDataSource = new DataSource({
            ...customAuthData,
            name: 'custom_auth_db',
        });
        this.customAutDataSource.initialize();
        const snapData = this.configService.get('snap_database' as any);
        this.snapDataSource = new DataSource({
            ...snapData,
            name: 'snap_db',
        });
        this.snapDataSource.initialize();
        const paymentDataSource = this.configService.get('payment_database' as any);
        this.paymentDataSource = new DataSource({
            ...paymentDataSource,
            name: 'payment_db',
        });
        this.paymentDataSource.initialize();
        const defaultData = this.configService.get('database' as any);
        this.defaultDataSource = new DataSource({
            ...defaultData,
            name: 'default',
        });
        this.defaultDataSource.initialize();
        return this.dataSource;
    }
    async getRelayerTransactionList(walletAddress: any, start: any, end: any, where: any): Promise<RelayerTransactionEntity[]> {
        if (walletAddress.length === 0) {
            return [];
        }
        let in_address = [];
        for (let item of walletAddress) {
            in_address.push(`x'${item}'`);
        }
        let sql = `select chain_id as chainId, gas_limit as gasLimit,gas_price as gasPrice,discount,hex(fee_token) as feeToken,fee_token_price as feeTokenPrice,hex(chain_tx_hash) as chainTxHash,transaction, hex(submitter) as submitter, hex(wallet_address) as walletAddress,
    FROM_UNIXTIME(UNIX_TIMESTAMP(gmt_updated),'%Y-%m-%d') as date from relayer_transactions where wallet_address in (${in_address.join(',')}) and status= ${TxStatus.SUCCESS} and gmt_updated>="${start}" and gmt_updated<= "${end}"`;
        sql = where ? `${sql} ${where}` : sql;
        const relayerDataManager = this.dataSource.manager;
        let list = [];
        try {
            list = await relayerDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return list;
    }
    async getRelayerTransactionCount(walletAddress: any, start: any, end: any): Promise<number> {
        if (walletAddress.length === 0) {
            return 0;
        }
        let in_address = [];
        for (let item of walletAddress) {
            in_address.push(`x'${item}'`);
        }
        let sql = `select count(*) as total from relayer_transactions where wallet_address in (${in_address.join(',')}) and status= ${TxStatus.SUCCESS} and gmt_updated>="${start}" and gmt_updated<= "${end}"`;
        const relayerDataManager = this.dataSource.manager;
        let total = 0;
        try {
            let data = await relayerDataManager.query(sql);
            total = data[0].total;
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return total;
    }
    async getPaymentTransactionList(start: any, end: any): Promise<getPaymentTransactionList[]> {
        const sql = `
    select 
    relayer.chain_id as chainId,
    relayer.gas_price as gasPrice,
    relayer.gas_used as gasLimit,
    hex(relayer.chain_tx_hash) as chainTxHash,
    sub.amount as feeAmount,
    hex(sub.token_address) as feeToken, 
    FROM_UNIXTIME(UNIX_TIMESTAMP(relayer.updated_at),'%Y-%m-%d') as date
    from relayer_sub_transaction sub JOIN
    payment_relayer_tx relayer ON relayer.id = sub.relayer_tx_id
    where relayer.status = 2 and sub.payment_type=1
    and relayer.updated_at >= "${start}" and relayer.updated_at <= "${end}" 
    `;
        const paymentDataManager = this.paymentDataSource.manager;
        let list = [];
        try {
            list = await paymentDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return list;
    }
    async getSnapAddress(): Promise<string[]> {
        let sql = `SELECT caai.app_name AS app, hex(caa.address) as address,caa.app_id as appId 
      FROM
          custom_auth_accounts caa 
      JOIN
          custom_auth_app_infos caai ON caa.app_id = caai.app_id
      where  caa.status >= 1 and caa.app_id = "${this.apiConfigService.SnapAppConfig.SnapAppId}" and caa.created_at>="2023-09-12 00:00:00"`;
        const customAutDataManager = this.customAutDataSource.manager;
        let list = [];
        try {
            list = await customAutDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        let snapAddress = [];
        for (let item of list) {
            snapAddress.push(item.address);
        }
        this.logger.log(`[getPaymentAndSnapAddress] snapAddress len = ${snapAddress.length} `);
        return snapAddress;
    }
    async getPaymentAddress(): Promise<string[]> {
        let sql = `select hex(address) as address from accounts where created_at>="2023-09-12 00:00:00"`;
        const paymentDataManager = this.paymentDataSource.manager;
        let list = [];
        try {
            list = await paymentDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        let paymentAddress = [];
        for (let item of list) {
            paymentAddress.push(item.address);
        }
        this.logger.log(`[getPaymentAddress] paymentAddress len = ${paymentAddress.length}`);
        return paymentAddress;
    }
    async getPaymentConsumeGasTransaction(start: any, end: any): Promise<getPaymentTransactionList[]> {
        const sql = `
    select 
    relayer.chain_id as chainId,
    relayer.gas_price as gasPrice,
    relayer.gas_used as gasLimit,
    hex(relayer.chain_tx_hash) as chainTxHash,  
    FROM_UNIXTIME(UNIX_TIMESTAMP(relayer.updated_at),'%Y-%m-%d') as date
    from payment_relayer_tx relayer  
    where relayer.status =2 and relayer.updated_at >= "${start}" and relayer.updated_at <= "${end}" 
    `;
        const paymentDataManager = this.paymentDataSource.manager;
        this.logger.log(`[getPaymentConsumeGasTransaction] sql = ${sql}`);
        let list = [];
        try {
            list = await paymentDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return list;
    }
    async getCustomTxFeeList(transaction: any, start: any, end: any): Promise<CustomTxFee[]> {
        if (transaction.length === 0) {
            return [];
        }
        let tx_hashs = [];
        for (let item of transaction) {
            tx_hashs.push(`x'${item}'`);
        }
        let sql = `select user_paid_gas as userPaidGas, consumed_fee as consumedFee,tank_paid_gas as tankPaidGas, hex(chain_tx_hash) as chainTxHash from  gas_consumption_history where chain_tx_hash in (${tx_hashs.join(',')}) and created_at >= "${start}" and created_at <= "${end}"`;
        const customAutDataManager = this.customAutDataSource.manager;
        let list = [];
        try {
            list = await customAutDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        for (let item of list) {
            item.discount = getCustomDiscount(item.userPaidGas, item.consumedFee);
        }
        this.logger.log(`[getCustomTxFeeList] list len = ${list.length}`);
        return list;
    }
    async getPaymentTx(start: any, end: any): Promise<import("../utils/interface").ParsePayment[]> {
        const sql = `
    select hex(p.wallet_address) as address,p.id,p.total_transaction_amount as paymentAmount,p.fee_token_amount as feeAmount,p.used_free_quota as freeQuota,
    FROM_UNIXTIME(UNIX_TIMESTAMP(p.updated_at),'%Y-%m-%d') as date,
    hex(output.to) as outputTo,
    hex(output.token_address) as outputTokenAddress,
    output.chain_id as outputChainId,
    output.amount as outputAmount,
    hex(sub.to) as subOutputTo, 
    hex(sub.token_address) as subTokenAddress,
    sub.amount as subAmount,
    sub.relayer_tx_id as subRelayerTxId,
    sub.payment_type as subPaymentType,
    hex(input.chain_tx_hash) as inputTxHash,
    input.chain_id as inputChainId,
    input.id as inputId
    from payment p
    LEFT JOIN
     payment_output output ON output.payment_id = p.id
    LEFT JOIN
     payment_relayer_tx input ON input.payment_id = p.id
    LEFT JOIN
     relayer_sub_transaction sub ON sub.payment_id = p.id and sub.payment_type = 2
    where p.status =2 and p.updated_at >= "${start}" and  p.updated_at <= "${end}"`;
        const paymentDataManager = this.paymentDataSource.manager;
        this.logger.log(`[getPaymentConsumeGasTransaction] sql = ${sql}`);
        let list = [];
        try {
            list = await paymentDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return parsePaymentData(list);
    }
    async getPaymentRegisterList(start: any, end: any): Promise<PaymentAccount[]> {
        let sql = `select hex(a.address) as address,a.provider, 
    FROM_UNIXTIME(UNIX_TIMESTAMP(a.created_at),'%Y-%m-%d') as date
    from accounts a  
    where a.created_at >= "${start}" and  a.created_at <= "${end}"`;
        const paymentDataManager = this.paymentDataSource.manager;
        let list = [];
        try {
            list = await paymentDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return list;
    }
    async getSnapRegisterList(start: any, end: any): Promise<PaymentAccount[]> {
        let sql = `select hex(a.account_address) as address,a.provider_type as provider, 
    FROM_UNIXTIME(UNIX_TIMESTAMP(a.register_time),'%Y-%m-%d') as date
    from snap_account a  
    where a.register_time >= "${start}" and  a.register_time <= "${end}"`;
        const snapDataManager = this.snapDataSource.manager;
        let list = [];
        try {
            list = await snapDataManager.query(sql);
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return list;
    }
    async getRelayerAccountCount(walletAddress: any): Promise<DeployInfo> {
        let deployInfo = {
            all: 0,
            polygon: 0,
            bsc: 0,
            arb: 0,
        };
        if (walletAddress.length === 0) {
            return deployInfo;
        }
        let in_address = [];
        for (let item of walletAddress) {
            in_address.push(`x'${item}'`);
        }
        const sql = `SELECT COUNT(DISTINCT wallet_address) AS totalAddresses  FROM relayer_transactions
    WHERE wallet_address in  (${in_address.join(',')}) and status= ${TxStatus.SUCCESS}`;
        const sql2 = `SELECT COUNT(DISTINCT wallet_address) AS totalAddresses, chain_id as chainId FROM relayer_transactions
    WHERE wallet_address  in  (${in_address.join(',')}) and status= ${TxStatus.SUCCESS} GROUP BY chainId; `;
        const relayerDataManager = this.dataSource.manager;
        try {
            let allData = await relayerDataManager.query(sql);
            deployInfo.all =
                allData.length > 0 ? Number(allData[0].totalAddresses) : 0;
            const chainList = await relayerDataManager.query(sql2);
            for (let item of chainList) {
                let chainName = getChainName(item.chainId);
                switch (chainName) {
                    case 'bsc':
                        deployInfo.bsc = Number(item.totalAddresses);
                    case 'polygon':
                        deployInfo.polygon = Number(item.totalAddresses);
                        break;
                    case 'arb':
                        deployInfo.arb = Number(item.totalAddresses);
                        break;
                    default:
                        break;
                }
            }
            return deployInfo;
        }
        catch (error) {
            this.logger.error((error as Error).message);
        }
        return deployInfo;
    }
}
