import { ClickHouseClient, createClient } from '@clickhouse/client';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { WSOL } from '../../common/utils';
import { UnknownError } from '../../error';

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
    configService: ConfigService;
    logger: any;
    client!: ClickHouseClient;
    constructor(configService: ConfigService) {
        this.configService = configService;
        this.logger = new Logger(ClickHouseService.name);
    }
    async onModuleInit(): Promise<void> {
        const config = this.configService.get('clickhouse');
        if (!config) {
            throw new Error('ClickHouse configuration not found');
        }
        this.client = createClient(config);
        try {
            await this.client.ping();
            this.logger.log('ClickHouse connected successfully');
        }
        catch (error) {
            throw new Error(`Failed to connect to ClickHouse: ${(error as Error).message}`);
        }
    }
    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.close();
        }
    }
    getClient(): ClickHouseClient {
        if (!this.client) {
            throw new Error('ClickHouse client not initialized');
        }
        return this.client;
    }
    async query(query: string, params?: Record<string, any>): Promise<any[]> {
        if (!this.client) {
            throw new Error('ClickHouse client not initialized');
        }
        try {
            const queryOptions = {
                query,
                query_params: params,
            };
            const result = await this.client.query(queryOptions);
            const response = await result.json();
            return response.data;
        }
        catch (error) {
            this.logger.error(`Query failed: ${query}, error: ${error}`);
            throw error;
        }
    }
    async insert(table: string, rows: any[]): Promise<any> {
        return await this.client.insert({
            table,
            values: rows,
            format: 'JSONEachRow',
        });
    }
    async stream(query: string, params?: Record<string, any>): Promise<any> {
        const resultSet = await this.client.query({
            query,
            format: 'JSONEachRow',
            query_params: params,
        });
        return resultSet.stream();
    }
    async dexTradesByTxId(txId: string, startTime: number, limit: number): Promise<DexTrade[]> {
        const data = await this.query(`SELECT 
        block_date as blockDate,
        block_time as blockTime,
        block_slot as blockSlot,
        tx_id as txId,
        tx_index as txIndex,
        signer as signer,
        pool_address as poolAddress,
        base_mint as baseMint,
        quote_mint as quoteMint,
        base_decimals as baseDecimals,
        quote_decimals as quoteDecimals,
        base_vault as baseVault,
        quote_vault as quoteVault,
        base_vault_balance as baseVaultBalance,
        quote_vault_balance as quoteVaultBalance,
        base_amount as baseAmount,
        quote_amount as quoteAmount,
        usd_value as usdValue,
        solana_price as solanaPrice,
        is_inner_instruction as isInnerInstruction,
        instruction_index as instructionIndex,
        instruction_type as instructionType,
        inner_instruction_index as innerInstructionIndex,
        outer_program as outerProgram,
        inner_program as innerProgram,
        txn_fee_lamports as txnFeeLamports,
        signer_lamports_change as signerLamportsChange,
        trader as trader,
        outer_executing_accounts as outerExecutingAccounts
      FROM dex_trades
      WHERE tx_id = {txId:String}
      AND block_time >= {startTime:Int}
      LIMIT {limit:Int}`, {
            txId,
            startTime,
            limit,
        });
        return data.map((ret) => {
            return new DexTrade(ret);
        });
    }
    async getTokenPriceByPool(pool: string): Promise<TokenPrice | undefined> {
        while (pool.length < 44) {
            pool = `${pool}\x00`;
        }
        let data;
        try {
            data = await this.query(`SELECT 
        pool_address as poolAddress,
        base_mint as baseMint,
        quote_mint as quoteMint,
        base_vault_balance as baseVaultBalance,
        quote_vault_balance as quoteVaultBalance,
        latest_price as latestPrice
      FROM mv_pool_prices
      WHERE pool_address = {pool:String}`, {
                pool,
            });
        }
        catch (error) {
            this.logger.error(`Get token price by pool failed: ${error}`);
            throw new UnknownError(error);
        }
        if (data.length === 0) {
            return undefined;
        }
        const price = data[0];
        return new TokenPrice(price);
    }
}

export class TokenPrice {
    poolAddress: string;
    baseMint: string;
    quoteMint: string;
    baseVaultBalance: Decimal;
    quoteVaultBalance: Decimal;
    latestPrice: Decimal;
    constructor(data: any) {
        while (data.poolAddress.endsWith('\x00')) {
            data.poolAddress = data.poolAddress.slice(0, -1);
        }
        this.poolAddress = data.poolAddress;
        this.baseMint = data.baseMint;
        this.quoteMint = data.quoteMint;
        this.baseVaultBalance = new Decimal(data.baseVaultBalance);
        this.quoteVaultBalance = new Decimal(data.quoteVaultBalance);
        this.latestPrice = new Decimal(data.latestPrice);
    }
}
export class DexTrade {
    data: any;
    constructor(data: any) {
        this.data = data;
        while (this.data.baseMint.endsWith('\x00')) {
            this.data.baseMint = this.data.baseMint.slice(0, -1);
        }
        while (this.data.quoteMint.endsWith('\x00')) {
            this.data.quoteMint = this.data.quoteMint.slice(0, -1);
        }
        while (this.data.poolAddress.endsWith('\x00')) {
            this.data.poolAddress = this.data.poolAddress.slice(0, -1);
        }
    }
    isValidPoolDexTrade(): boolean {
        return this.data.baseMint === WSOL || this.data.quoteMint === WSOL;
    }
    solMint(): string {
        if (this.data.baseMint === WSOL) {
            return this.data.baseMint;
        }
        else {
            return this.data.quoteMint;
        }
    }
    solNormalizedAmount(): Decimal {
        if (this.data.baseMint === WSOL) {
            return new Decimal(this.data.baseAmount).abs();
        }
        else {
            return new Decimal(this.data.quoteAmount).abs();
        }
    }
    solAmount(): Decimal {
        if (this.data.baseMint === WSOL) {
            return new Decimal(this.data.baseAmount)
                .abs()
                .mul(new Decimal(10).pow(this.data.baseDecimals));
        }
        else {
            return new Decimal(this.data.quoteAmount)
                .abs()
                .mul(new Decimal(10).pow(this.data.quoteDecimals));
        }
    }
    tokenMint(): string {
        if (this.data.baseMint === WSOL) {
            return this.data.quoteMint;
        }
        else {
            return this.data.baseMint;
        }
    }
    tokenAmount(): Decimal {
        if (this.data.baseMint === WSOL) {
            return new Decimal(this.data.quoteAmount)
                .abs()
                .mul(new Decimal(10).pow(this.data.quoteDecimals));
        }
        else {
            return new Decimal(this.data.baseAmount)
                .abs()
                .mul(new Decimal(10).pow(this.data.baseDecimals));
        }
    }
    tokenNormalizedAmount(): Decimal {
        if (this.data.baseMint === WSOL) {
            return new Decimal(this.data.quoteAmount).abs();
        }
        else {
            return new Decimal(this.data.baseAmount).abs();
        }
    }
}
