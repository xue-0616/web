import Decimal from 'decimal.js';
import moment from 'moment';
import { BadRequestException } from '@nestjs/common';
import { StatusName } from '../../../shared/utils';

export const NFTs = [
    {
        nft: 'HongKong',
        NFTIndex: 0,
        contractAddress: process.env.ACTIVITY_HK_CONTRACT_ADDRESS || '0x',
        weight: 30,
    },
    {
        nft: 'WanXiang',
        NFTIndex: 1,
        weight: 40,
        contractAddress: process.env.ACTIVITY_WX_CONTRACT_ADDRESS || '0x',
    },
    {
        nft: 'UniPass',
        NFTIndex: 2,
        weight: 30,
        contractAddress: process.env.ACTIVITY_UP_CONTRACT_ADDRESS || '0x',
    },
];
interface NftDef {
    nft: string;
    NFTIndex: number;
    contractAddress: string;
    weight: number;
}
interface UniverseLogger {
    log(msg: string): void;
    error(msg: string): void;
}
export const getNftIndexByAddress = (address: string, logger: UniverseLogger): number => {
    for (const item of NFTs as NftDef[]) {
        logger.log(`[getNftIndexByAddress]  for item ${item.contractAddress} address ${address}  ${address.toLocaleLowerCase() === item.contractAddress.toLocaleLowerCase()}`);
        if (address.toLocaleLowerCase() === item.contractAddress.toLocaleLowerCase()) {
            return item.NFTIndex;
        }
    }
    logger.error(`[getNftIndexByAddress] address not find ${address}`);
    throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
};
export const getRandomNftMint = (logger?: UniverseLogger): NftDef => {
    let totalRank = 0;
    const random = Math.random();
    let result: NftDef | undefined;
    const items: NftDef[] = (NFTs as NftDef[]).map((item) => {
        totalRank += item.weight;
        return item;
    });
    let start = 0;
    while (items.length > 0) {
        const item = items.shift()!;
        const end = new Decimal(start)
            .add(new Decimal(item.weight).div(new Decimal(totalRank)))
            .toNumber();
        if (random > start && random <= end) {
            result = item;
            if (logger) {
                logger.log(`[getRandomNftMint] ${JSON.stringify({
                    start,
                    end,
                    random,
                    result,
                })}`);
            }
            else {
                console.info(`[getRandomNftMint] ${JSON.stringify({
                    start,
                    end,
                    random,
                    result,
                })}`);
            }
            break;
        }
        start = end;
    }
    return result ? result : (NFTs as NftDef[])[0];
};
const timeWeight = [
    {
        weight: [1, 2, 3, 4],
        index: 0,
    },
    {
        index: 1,
        weight: [5, 6],
    },
    {
        index: 2,
        weight: [7, 8, 9, 0],
    },
];
export const testRandomByTimestamp = () => {
    const map = new Map();
    for (let item = 0; item < 10; item++) {
        const time = moment().millisecond();
        const weight = time.toString().slice(-1);
        let index = 0;
        for (const items of timeWeight) {
            if (items.weight.includes(Number(weight))) {
                index = items.index;
            }
        }
        const nft = (NFTs as NftDef[])[index];
        const times = map.get(nft.nft);
        if (!times) {
            map.set(nft.nft, 1);
        }
        else {
            map.set(nft.nft, times + 1);
        }
    }
    console.info(map);
};
export const testRandomByWeight = () => {
    const map = new Map();
    for (let item = 0; item < 1; item++) {
        const nft = getRandomNftMint();
        const times = map.get(nft.nft);
        if (!times) {
            map.set(nft.nft, 1);
        }
        else {
            map.set(nft.nft, times + 1);
        }
    }
    console.info(map);
};
