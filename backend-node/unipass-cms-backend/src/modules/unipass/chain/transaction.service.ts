import { Injectable } from '@nestjs/common';
import { Wallet, formatEther, parseEther } from 'ethers';
import { ProviderService } from '../../../shared/services/providers.server';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { RedisService } from '../../../shared/services/redis.service';

@Injectable()
export class TransactionService {
    apiConfigService;
    providerService;
    redisService;
    constructor(apiConfigService: ApiConfigService, providerService: ProviderService, redisService: RedisService) {
        this.apiConfigService = apiConfigService;
        this.providerService = providerService;
        this.redisService = redisService;
    }
    async getEthBanance(): Promise<string> {
        const provider = this.providerService.getProvider(this.apiConfigService.getContractConfig.ethTestnetNodeName);
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, provider);
        const eth = await provider.getBalance(wallet.address);
        return formatEther(eth);
    }
    async getPolygonBanance(): Promise<string> {
        const provider = this.providerService.getProvider(this.apiConfigService.getContractConfig.genTestnetNodeName);
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, provider);
        const matic = await provider.getBalance(wallet.address);
        return formatEther(matic);
    }
    async getRangersBanance(): Promise<string> {
        const provider = this.providerService.getProvider(this.apiConfigService.getContractConfig.rangersTestnetNodeNmae);
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, provider);
        const rpg = await provider.getBalance(wallet.address);
        return formatEther(rpg);
    }
    async getBscBanance(): Promise<string> {
        const provider = this.providerService.getProvider(this.apiConfigService.getContractConfig.bscTestnetNodeName);
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, provider);
        const bnb = await provider.getBalance(wallet.address);
        return formatEther(bnb);
    }
    async showWalletBanance(): Promise<any> {
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey);
        const key = `banances:${wallet.address}`;
        const redisData = await this.redisService.getRedis().get(key);
        if (redisData) {
            return JSON.parse(redisData);
        }
        const polygon = this.getPolygonBanance();
        const eth = this.getEthBanance();
        const bsc = this.getBscBanance();
        const rangers = this.getRangersBanance();
        const [Matic, Eth, Bnb, Rpg] = await Promise.all([
            polygon,
            eth,
            bsc,
            rangers,
        ]);
        const data = { Matic, Eth, Bnb, Rpg, address: wallet.address };
        await this.redisService
            .getRedis()
            .set(key, JSON.stringify(data), 'EX', 60 * 1);
        return data;
    }
    async startSendTransaction(wallet: any, tx: any): Promise<any> {
        try {
            const txData = await wallet.sendTransaction(tx);
            this.waitTx(txData, wallet);
            return { transactionHash: txData.hash };
        }
        catch (error) {
            return { error };
        }
    }
    async waitTx(txData: any, wallet: any): Promise<void> {
        let network;
        try {
            network = await wallet.provider.getNetwork();
            console.info(`${JSON.stringify(network)} .wait()`);
            const data = await txData.wait();
            console.info({
                data: { status: data.status, hash: data.transactionHash },
                network,
            });
        }
        catch (error) {
            console.error({ error, network });
        }
    }
    async sendBnbTransaction(tx: any): Promise<any> {
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, this.providerService.getProvider(this.apiConfigService.getContractConfig.bscTestnetNodeName));
        const bnb = await this.getBscBanance();
        if (bnb < formatEther(tx.value)) {
            return `banance not enough bnb ${bnb} value = ${formatEther(tx.value)}`;
        }
        return await this.startSendTransaction(wallet, tx);
    }
    async sendEthTransaction(tx: any): Promise<any> {
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, this.providerService.getProvider(this.apiConfigService.getContractConfig.ethTestnetNodeName));
        const eth = await this.getEthBanance();
        if (eth < formatEther(tx.value)) {
            return `banance not enough eth ${eth} value = ${formatEther(tx.value)}`;
        }
        return await this.startSendTransaction(wallet, tx);
    }
    async sendRangersTransaction(tx: any): Promise<any> {
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, this.providerService.getProvider(this.apiConfigService.getContractConfig.rangersTestnetNodeNmae));
        const rpg = await this.getRangersBanance();
        if (rpg < formatEther(tx.value)) {
            return `banance not enough rpg ${rpg} value = ${formatEther(tx.value)}`;
        }
        return await this.startSendTransaction(wallet, tx);
    }
    async sendPolygonTransaction(tx: any): Promise<any> {
        const wallet = new Wallet(this.apiConfigService.getContractConfig.eoaPrivateKey, this.providerService.getProvider(this.apiConfigService.getContractConfig.genTestnetNodeName));
        const matic = await this.getPolygonBanance();
        if (matic < formatEther(tx.value)) {
            return `banance not enough matic ${matic} value = ${formatEther(tx.value)}`;
        }
        return await this.startSendTransaction(wallet, tx);
    }
    async sendTransaction(address: any, value = '0.01'): Promise<any> {
        const banance = await this.showWalletBanance();
        if (!address) {
            return { banance };
        }

        // SECURITY FIX (BUG-16): Enforce per-transaction value limits and daily transaction caps
        // to prevent a compromised admin account from draining the relayer wallet.
        const MAX_TX_VALUE_ETH = parseFloat(process.env.MAX_ADMIN_TX_VALUE || '0.1');
        const MAX_DAILY_TX_COUNT = parseInt(process.env.MAX_ADMIN_DAILY_TX || '10', 10);

        const parsedValue = parseFloat(value);
        if (parsedValue > MAX_TX_VALUE_ETH) {
            return { banance, error: `Transaction value ${value} exceeds maximum allowed ${MAX_TX_VALUE_ETH}` };
        }
        if (parsedValue <= 0 || isNaN(parsedValue)) {
            return { banance, error: `Invalid transaction value: ${value}` };
        }

        // Daily transaction rate limiting via Redis
        const dailyKey = `admin:sendTx:daily:${new Date().toISOString().slice(0, 10)}`;
        const dailyCountStr = await this.redisService.getRedis().get(dailyKey);
        const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
        if (dailyCount >= MAX_DAILY_TX_COUNT) {
            return { banance, error: `Daily transaction limit (${MAX_DAILY_TX_COUNT}) exceeded` };
        }
        await this.redisService.getRedis().set(dailyKey, (dailyCount + 1).toString(), 'EX', 86400);

        try {
            const tx = {
                to: address,
                value: parseEther(value),
                gasLimit: 210000n,
            };
            const Matic = this.sendPolygonTransaction(tx);
            const Eth = this.sendEthTransaction(tx);
            const Bnb = this.sendBnbTransaction(tx);
            const Rpg = this.sendRangersTransaction(tx);
            const [MaticTx, EthTx, BnbTx, RpgTx] = await Promise.all([
                Matic,
                Eth,
                Bnb,
                Rpg,
            ]);
            const txData = { MaticTx, EthTx, BnbTx, RpgTx };
            return { banance, txData };
        }
        catch (error) {
            console.error(error);
            return { banance };
        }
    }
}
