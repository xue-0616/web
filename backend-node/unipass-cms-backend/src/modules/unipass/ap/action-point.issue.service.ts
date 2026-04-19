import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { AdminGetActionPointBalanceInput, ApIssueInfo, IssueActionPointInput } from '../../../modules/unipass/dto/issue.ap.input';
import { UpHttpService } from '../../../shared/services/up.http.service';
import { AdminGetActionPointBalanceOutput, IssueActionPointOutput } from '../../../modules/unipass/dto/issue.ap.output';
import { getBytes, keccak256, solidityPacked } from 'ethers';
import { Wallet } from 'ethers';
import { ApiException } from '../../../common/exceptions/api.exception';
import { getUnixTime } from 'date-fns';

@Injectable()
export class ActionPointIssueService {
    private wallet: Wallet;
    constructor(
        private readonly apiConfigService: ApiConfigService,
        private readonly upHttp: UpHttpService,
    ) {
        this.wallet = new Wallet(this.apiConfigService.getApConfig.adminPrivateKey);
    }
    async issueActionPoint(input: IssueActionPointInput): Promise<IssueActionPointOutput> {
        const { address, walletHost } = input;
        const timestamp = getUnixTime(new Date());
        const apIssueList = this.formateIssueAddress(address);
        let adminSig;
        try {
            const rawData = `UniPass:AP:Issue:${timestamp}:${JSON.stringify(apIssueList)}`;
            adminSig = await this.wallet.signMessage(rawData);
        }
        catch (error) {
            throw new ApiException(10000);
        }
        const url = `${walletHost}/api/v1/ap/admin/issue`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        const inputData = { adminSig, timestamp, apIssueList };
        const data = await this.upHttp.httpPost(url, inputData, config);
        console.info(`[issueActionPoint] url = ${url} data = ${JSON.stringify({
            data,
            inputData,
        })}`);
        if (!data) {
            throw new ApiException(10000);
        }
        return data.data;
    }
    async getActionPointBalance(input: AdminGetActionPointBalanceInput): Promise<AdminGetActionPointBalanceOutput> {
        const { address, walletHost } = input;
        const addresses = this.formateAddress(address);
        const timestamp = getUnixTime(new Date());
        let adminSig;
        try {
            const byteArrays = addresses.map((address) => getBytes(address));
            const rawData = keccak256(solidityPacked(['bytes[]', 'uint32'], [byteArrays, timestamp]));
            adminSig = await this.wallet.signMessage(rawData);
        }
        catch (error) {
            throw new ApiException(10000);
        }
        const url = `${walletHost}/api/v1/ap/admin/balance`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        const inputData = { ...input, adminSig, timestamp, addresses };
        const data = await this.upHttp.httpPost(url, inputData, config);
        console.info(`[getActionPointBalance] url = ${url} data = ${JSON.stringify({
            inputData,
            data,
        })} `);
        if (!data) {
            throw new ApiException(10000);
        }
        return data.data;
    }
    formateAddress(address: any): string[] {
        const addresses = address
            .split('"')
            .join('')
            .split(' ')
            .join('')
            .split(',')
            .filter((value: any, index: any, self: any) => {
            value = value.split('"').join('').trim();
            return self.indexOf(value) === index;
        });
        return addresses;
    }
    formateIssueAddress(address: any): ApIssueInfo[] {
        const addresses = address
            .split('"')
            .join('')
            .split(' ')
            .join('')
            .split(',')
            .filter((value: any, index: any, self: any) => {
            value = value.split('"').join('').trim();
            return self.indexOf(value) === index;
        });
        const list = [];
        for (const item of addresses) {
            const info = item.split(':');
            if (info.length < 2) {
                continue;
            }
            const apInfo = {
                address: info[0],
                ap: info[1],
            };
            list.push(apInfo);
        }
        return list;
    }
}
