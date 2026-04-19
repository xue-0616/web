import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountStatus } from '../entities';
import { StatusName, getPolicySign } from '../../../shared/utils';
// ethers v6: BigNumber removed — use native BigInt
import { digestTxHash } from '@unipasswallet/transactions';

@Injectable()
export class EIP4337Service {
    constructor(logger: any, oriHashDBService: any) {
        this.logger = logger;
        this.oriHashDBService = oriHashDBService;
        this.logger.setContext(EIP4337Service.name);
    }
    logger: any;
    oriHashDBService: any;
    async getPolicySign(input: any, user: any) {
            const { chainId, nonce, txs } = input;
            const { address, status, keysetHash } = user;
            if (status === AccountStatus.pending) {
                throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
            }
            let transactions = [];
            try {
                transactions = txs.map((tx: any) => {
                    const transaction = {
                        _isUnipassWalletTransaction: true,
                        callType: tx.callType,
                        data: tx.data,
                        revertOnError: true,
                        gasLimit: BigInt(tx.gasLimit),
                        target: tx.target,
                        value: BigInt(tx.value),
                    };
                    return transaction;
                });
            }
            catch (_a) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (transactions.length === 0) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const digestHash = digestTxHash(chainId, address, nonce, transactions);
            this.logger.log(`[getPolicySign] digestHash=${digestHash}`);
            const { keyset: keysetJson } = await this.oriHashDBService.getKeyset(keysetHash);
            const policySig = await getPolicySign(keysetJson, digestHash, this.logger);
            return { policySig };
        }
}
