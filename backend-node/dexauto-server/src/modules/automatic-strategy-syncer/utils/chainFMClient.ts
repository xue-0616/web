import { Logger } from '@nestjs/common';
import axios from 'axios';
import { BadRequestException, UnknownError } from '../../../error';

const CHAIN_FM_URL = 'https://chain.fm/api/trpc';

export interface ChannelInfo {
    addresses: { address: string }[];
    [key: string]: any;
}

export class ChainFMClient {
    logger: any;
    instance: any;
    constructor() {
        this.logger = new Logger(ChainFMClient.name);
        this.instance = axios.create({
            baseURL: CHAIN_FM_URL,
        });
    }
    async getChannelInfo(channelId: any): Promise<ChannelInfo> {
        const response = await this.instance.get(`/channel.get?batch=1&input={"0":{"json":"${channelId}"}}`);
        if (response.status !== 200) {
            this.logger.error(`Error fetching channel info: ${JSON.stringify(response)}`);
            throw new UnknownError('error fetching channel info');
        }
        const data = response.data;
        if (data.error) {
            this.logger.error(`Error fetching channel info: ${JSON.stringify(data)}`);
            throw new UnknownError(data.error.message);
        }
        if (Array.isArray(data)) {
            if (isTRpcResponse(data[0])) {
                const info = data[0].result.data.json;
                if (isChannelInfo(info)) {
                    return info;
                }
            }
        }
        if (isTRpcResponse(data)) {
            const info = data.result.data.json;
            if (isChannelInfo(info)) {
                return info;
            }
        }
        this.logger.error(`Invalid channel id: ${channelId}, data: ${JSON.stringify(data)}`);
        throw new BadRequestException('invalid channel id');
    }
}
function isTRpcResponse(data: any) {
    return (data !== null &&
        typeof data === 'object' &&
        data.result &&
        typeof data.result === 'object' &&
        data.result.data &&
        typeof data.result.data === 'object' &&
        'json' in data.result.data);
}
function isChannelInfo(data: any) {
    if (!data || typeof data !== 'object')
        return false;
    return Array.isArray(data.addresses) && data.addresses.every(isAddress);
}
function isAddress(data: any) {
    if (!data || typeof data !== 'object')
        return false;
    return typeof data.address === 'string';
}
