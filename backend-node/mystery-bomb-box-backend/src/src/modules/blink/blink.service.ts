import { Injectable } from '@nestjs/common';
import { BlinkListInputDto, BlinkType } from './dto/blink.list.input.dto';
import { BlinkOutputDto } from './dto/blink.list.output.dto';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { MysteryBoxDbService } from '../db/mystery-boxs.service';
import { MysteryBoxEntity, MysteryBoxStatus } from '../../database/entities/mystery-boxs.entity';
import { MyHttpService } from '../../common/utils-service/http.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { BlinkShortCode } from '../../common/interface/bot.response';
import { encodeBase58 } from '../../common/utils/tools';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { In } from 'typeorm';

@Injectable()
export class BlinkService {
    constructor(private readonly logger: AppLoggerService, private readonly redpacketsDbService: MysteryBoxDbService, private readonly myHttpService: MyHttpService, private readonly appConfig: AppConfigService) {
        this.logger.setContext(BlinkService.name);
    }
    async queryBlinkList(input: BlinkListInputDto): Promise<BlinkOutputDto> {
            const entities = await this.queryRedpacketsEntities(input);
            const blinkShortCodes = await this.getBlinkShortCode(entities);
            const list = entities.map((entity) => {
                const blinkIdInfo = blinkShortCodes
                    ? blinkShortCodes.find((blink) => {
                        return blink.id === Number(entity.id);
                    })
                    : null;
                let directLink = null;
                if (blinkIdInfo) {
                    let base58Str = encodeBase58(JSON.stringify({ short_code: blinkIdInfo.shortCode }));
                    directLink = `${this.appConfig.actionInfo.blinkWindowDirectLink}?startapp=${base58Str}`;
                }
                return {
                    mysteryBoxAmount: Number(BigInt(entity.amount)) / LAMPORTS_PER_SOL,
                    bombNumber: entity.bombNumber,
                    totalBoxCount: Number(entity.openLimit),
                    participantCount: Number(entity.openCount),
                    startTime: entity.grabStartTime,
                    initiatorAddress: entity.senderAddress,
                    blinkUrl: blinkIdInfo
                        ? blinkIdInfo.blink
                        : `${this.appConfig.actionInfo.hostname}/box/actions/grab/${entity.id}`,
                    directLink: directLink,
                    winLossAmount: entity.lotteryDrawAmount
                        ? Number(BigInt(entity.lotteryDrawAmount)) / LAMPORTS_PER_SOL
                        : 0,
                    id: Number(entity.id),
                };
            });
            return { list };
        }
    async getBlinkShortCode(entities: MysteryBoxEntity[]): Promise<BlinkShortCode[] | null> {
            const blinks = entities.map((entity) => ({
                blink: `${this.appConfig.actionInfo.hostname}/box/actions/grab/${entity.id}`,
                id: entity.id,
            }));
            let domain = new URL(this.appConfig.actionInfo.hostname).host;
            let body = { blinks, domain };
            let url = `${this.appConfig.actionInfo.botService}/solagram/api/v1/blink/shortcode/query`;
            let data = await this.myHttpService.httpPost(url, body);
            return data ? data.data : null;
        }
    async queryRedpacketsEntities(input: BlinkListInputDto): Promise<MysteryBoxEntity[]> {
            const { page, limit, type } = input;
            let blinkType = type === BlinkType.InProgress
                ? [MysteryBoxStatus.GRABBING]
                : [
                    MysteryBoxStatus.GRAB_ENDED,
                    MysteryBoxStatus.DISTRIBUTE_INIT,
                    MysteryBoxStatus.DISTRIBUTE_PENDING,
                    MysteryBoxStatus.DISTRIBUTE_CONFIRMED,
                    MysteryBoxStatus.DISTRIBUTE_FAILED,
                ];
            const entities = await this.redpacketsDbService.find({ status: In(blinkType) }, { grabMysteryBoxs: true }, page * limit, limit);
            return entities;
        }
}
