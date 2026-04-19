import { Injectable } from '@nestjs/common';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { stringify } from 'querystring';
import { ProviderService } from '../../../shared/services/providers.server';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { BlockTag, getUnipassWalletContext } from '../../../modules/unipass/chain/utils';
import { IUnipassChainInfo } from '../../../modules/unipass/dto/unipass.dto';
import { UpHttpService } from '../../../shared/services/up.http.service';
import { EventInfo, TxErc20, TxInternal, TxNormal } from '../../../modules/unipass/class/chain.class';
import { moduleMain } from '@unipasswallet/abi';

const Topics: Record<string, string> = {
    updateOpenIdKey: '0x532446a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b3',
    deleteOpenIdKey: '0x6e646a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b4',
    updateDkimTopic1: '0x7e746a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b5',
    updateDkimTopic2: '0x8e846a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b6',
    deleteDkimTopic: '0x9e946a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b7',
};

@Injectable()
export class QueryAbiService {
    apiConfigService;
    providerService;
    upHttpService;
    provider!: any;
    moduleMainContract!: any;
    constructor(apiConfigService: ApiConfigService, providerService: ProviderService, upHttpService: UpHttpService) {
        this.apiConfigService = apiConfigService;
        this.providerService = providerService;
        this.upHttpService = upHttpService;
        this.initContract();
    }
    initContract(): void {
        this.provider = this.providerService.getProvider(undefined);
        this.moduleMainContract = new Contract(getUnipassWalletContext().moduleMain, moduleMain.abi, this.provider);
    }
    getModuleMainContract(): Contract {
        return this.moduleMainContract;
    }
    async getAccountInfo(address: any, chainNode: any): Promise<IUnipassChainInfo> {
        if (!chainNode) {
            chainNode = this.apiConfigService.getContractConfig.genNodeName;
        }
        const rpcUrl = `${this.apiConfigService.getContractConfig.rpcNodeUrl}/${chainNode}`;
        try {
            const provider = new JsonRpcProvider(rpcUrl);
            const walletAbi = [
                'function getMetaNonce() view returns (uint256)',
                'function getKeysetHash() view returns (bytes32)',
                'function getLockInfo() view returns (bool isLockedRet, uint32 lockDuringRet, bytes32 lockedKeysetHashRet, uint256 unlockAfterRet)',
            ];
            const walletContract = new Contract(address, walletAbi, provider);
            const [metaNonceRaw, keysetHash, lockInfoRaw] = await Promise.all([
                walletContract.getMetaNonce(),
                walletContract.getKeysetHash(),
                walletContract.getLockInfo(),
            ]);
            const metaNonce = Number(metaNonceRaw) + 1;
            const isPending = lockInfoRaw.isLockedRet;
            const newKeysetHash = lockInfoRaw.lockedKeysetHashRet;
            const unlockTime = Number(lockInfoRaw.unlockAfterRet);
            const lockDuration = lockInfoRaw.lockDuringRet;
            const accountChainInfo = {
                isPending,
                pendingKeysetHash: newKeysetHash,
                keysetHash,
                unlockTime,
                lockDuration,
                metaNonce,
                keysetHashRaw: '',
                pendingKeysethashRaw: '',
            };
            return accountChainInfo;
        }
        catch (error) {
            console.info(`[getAccountInfo] ${error}, data=${JSON.stringify({
                address,
                chainNode,
                rpcUrl,
            })}`);
            return {
                isPending: false,
                pendingKeysetHash: '',
                keysetHash: '',
                unlockTime: 0,
                lockDuration: 0,
                metaNonce: 0,
                keysetHashRaw: '',
                pendingKeysethashRaw: '',
            };
        }
    }
    async getNormalTransatcion(address: any, page = 1, offset = 10, startBlock: any, endBlock: any): Promise<TxInternal[]> {
        const apiKey = this.apiConfigService.getPolygonScanConfig.apiKey;
        const contents = {
            action: 'txlist',
            address,
            module: 'account',
            startblock: startBlock == null ? 0 : startBlock,
            endblock: endBlock == null ? 99999999 : endBlock,
            sort: 'asc',
            apiKey,
            offset,
            page,
        };
        const paramst = stringify(contents);
        const url = `${this.apiConfigService.getPolygonScanConfig.host}/api?${paramst}`;
        const data = await this.upHttpService.httpGet(url);
        let txInternal = [];
        if (data) {
            txInternal = data.result;
        }
        return txInternal;
    }
    async getInternalTransaction(address: any, startBlock: any, endBlock: any): Promise<TxNormal[]> {
        const apiKey = this.apiConfigService.getPolygonScanConfig.apiKey;
        const contents = {
            action: 'txlistinternal',
            address,
            module: 'account',
            startblock: startBlock == null ? 0 : startBlock,
            endblock: endBlock == null ? 99999999 : endBlock,
            sort: 'asc',
            apiKey,
            offset: 1000,
            page: 1,
        };
        const paramst = stringify(contents);
        const url = `${this.apiConfigService.getPolygonScanConfig.host}/api?${paramst}`;
        const data = await this.upHttpService.httpGet(url);
        let txInternal = [];
        if (data) {
            txInternal = data.result;
        }
        return txInternal;
    }
    async getErc20Transaction(address: any, page = 1, offset = 10): Promise<TxErc20[]> {
        const apiKey = this.apiConfigService.getPolygonScanConfig.apiKey;
        const contents = {
            module: 'account',
            action: 'tokentx',
            address,
            page,
            offset,
            sort: 'asc',
            apiKey,
        };
        const paramst = stringify(contents);
        const url = `${this.apiConfigService.getPolygonScanConfig.host}/api?${paramst}`;
        const data = await this.upHttpService.httpGet(url);
        let txInternal: any[] = [];
        if (data) {
            txInternal = data.result;
        }
        return txInternal;
    }
    async getSetSourceEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const setSource = proxyModuleMainContract.filters.SetSource();
        const txInternal = await this.getLogs(setSource.topics[0], address, fromBlock, toBlock);
        console.info({ setSource, txInternal });
        return txInternal;
    }
    async getUpdateKeysetHashEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const updateKeysetHash = proxyModuleMainContract.filters.UpdateKeysetHash();
        const txInternal = await this.getLogs(updateKeysetHash.topics[0], address, fromBlock, toBlock);
        return txInternal;
    }
    async getUpdateKeysetHashWithTimeLockEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const updateKeysetHashWithTimeLock = proxyModuleMainContract.filters.UpdateKeysetHashWithTimeLock();
        const txInternal = await this.getLogs(updateKeysetHashWithTimeLock.topics[0], address, fromBlock, toBlock);
        return txInternal;
    }
    async getCancelLockKeysetHashEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const cancelLockKeysetHash = proxyModuleMainContract.filters.CancelLockKeysetHash();
        const txInternal = await this.getLogs(cancelLockKeysetHash.topics[0], address, fromBlock, toBlock);
        return txInternal;
    }
    async getUnlockKeysetHashEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const unlockKeysetHash = proxyModuleMainContract.filters.UnlockKeysetHash();
        const txInternal = await this.getLogs(unlockKeysetHash.topics[0], address, fromBlock, toBlock);
        return txInternal;
    }
    async getSyncAccountEvent(address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const proxyModuleMainContract = this.moduleMainContract.attach(address);
        const syncAccount = proxyModuleMainContract.filters.SyncAccount();
        const txInternal = await this.getLogs(syncAccount.topics[0], address, fromBlock, toBlock);
        return txInternal;
    }
    async getLogs(topic0: any, address: any, fromBlock = 0, toBlock = 99999999): Promise<EventInfo[]> {
        const apiKey = this.apiConfigService.getPolygonScanConfig.apiKey;
        const contents = {
            module: 'logs',
            action: 'getLogs',
            fromBlock,
            toBlock,
            address,
            topic0,
            apiKey,
        };
        const paramst = stringify(contents);
        const url = `${this.apiConfigService.getPolygonScanConfig.host}/api?${paramst}`;
        const data = await this.upHttpService.httpGet(url);
        let event: any[] = [];
        if (data) {
            event = data.result;
        }
        return event;
    }
    async getAccountEventList(address: any, fromBlock = 0, toBlock = 99999999): Promise<any[]> {
        let evernt: any[] = [];
        const sourceEvent = await this.getSetSourceEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(sourceEvent);
        const updateKeysetHashEvent = await this.getUpdateKeysetHashEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(updateKeysetHashEvent);
        const updateKeysetHashWithTimeLockEvent = await this.getUpdateKeysetHashWithTimeLockEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(updateKeysetHashWithTimeLockEvent);
        const cancelLockKeysetHashEvent = await this.getUnlockKeysetHashEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(cancelLockKeysetHashEvent);
        const unlockKeysetHashEvent = await this.getUnlockKeysetHashEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(unlockKeysetHashEvent);
        const syncAccountEvent = await this.getSyncAccountEvent(address, fromBlock, toBlock);
        evernt = evernt.concat(syncAccountEvent);
        return evernt.sort((a, b) => {
            if (a.timeStamp! > b.timeStamp!) {
                return 1;
            }
            return -1;
        });
    }
    getEventTopics(): void {
        const contractInterface = new Interface(moduleMain.abi);
        contractInterface.forEachEvent((event) => {
            try {
                console.log(event.name, event.topicHash);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    async getModuleguestTranascation(fromBlock = '0', toBlock = '99999999'): Promise<EventInfo[]> {
        const address = getUnipassWalletContext().moduleGuest;
        const TxFailedEventTopic = '0x532446a9954c94d26bc0b829f9fc4fa09b0e2918874b15088d7c782c5288b8b3';
        const failTxList = await this.getTranascationFailLogs(TxFailedEventTopic, fromBlock, toBlock, address);
        return failTxList;
    }
    async getTranascationFailLogs(topic0: any, fromBlock: any, toBlock: any, address: any): Promise<EventInfo[]> {
        const apiKey = this.apiConfigService.getPolygonScanConfig.apiKey;
        const base = {
            module: 'logs',
            action: 'getLogs',
            fromBlock,
            toBlock,
            topic0,
            apiKey,
        };
        const contents = address ? { address, ...base } : base;
        const paramst = stringify(contents);
        const url = `${this.apiConfigService.getPolygonScanConfig.host}/api?${paramst}`;
        const data = await this.upHttpService.httpGet(url);
        let event: any[] = [];
        if (data) {
            event = data.result;
        }
        return event;
    }
    async getChainUpdateOpenId(fromBlock = '0', toBlock = '99999999'): Promise<EventInfo[][]> {
        const address = this.apiConfigService.getContractConfig.updateOpenIdAddress;
        const updateOpenIdList = await this.getTranascationFailLogs(Topics.updateOpenIdKey, fromBlock, toBlock, address);
        const deleteOpenIdTopicList = await this.getTranascationFailLogs(Topics.deleteOpenIdKey, fromBlock, toBlock, address);
        const update = updateOpenIdList.sort((a, b) => {
            if (a.timeStamp! < b.timeStamp!) {
                return 1;
            }
            return -1;
        });
        return [deleteOpenIdTopicList, update];
    }
    async getUpdateDkimEvents(fromBlock = '0', toBlock = '99999999'): Promise<EventInfo[][]> {
        const address = this.apiConfigService.getContractConfig.updateDkimAddress;
        const updateDkimKeyTopic1EventList = await this.getTranascationFailLogs(Topics.updateDkimTopic1, fromBlock, toBlock, address);
        const updateDkimKeyTopic2EventList = await this.getTranascationFailLogs(Topics.updateDkimTopic2, fromBlock, toBlock, address);
        const event = updateDkimKeyTopic1EventList.concat(updateDkimKeyTopic2EventList);
        const deleteDkimKeyEventList = await this.getTranascationFailLogs(Topics.deleteDkimTopic, fromBlock, toBlock, address);
        event.sort((a, b) => {
            if (a.timeStamp! < b.timeStamp!) {
                return 1;
            }
            return -1;
        });
        return [deleteDkimKeyEventList, event];
    }
    async getEventList(topic: any, fromBlock = '0', toBlock = '99999999'): Promise<EventInfo[]> {
        const topic1EventList = await this.getTranascationFailLogs(topic, fromBlock, toBlock, undefined);
        console.info({
            fromBlock,
            toBlock,
            length: topic1EventList.length,
        });
        return topic1EventList.sort((a, b) => {
            if (a.timeStamp! < b.timeStamp!) {
                return 1;
            }
            return -1;
        });
    }
}
