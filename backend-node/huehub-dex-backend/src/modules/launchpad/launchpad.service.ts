import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { LaunchpadProjectInputDto } from './dto/launchpad.project.input.dto';
import { LaunchpadTokensDbService, MintHistotyDbService, WhitelistDbService } from './db.service';
import { LaunchpadTokenEntity } from '../../database/entities/launchpad.tokens.entity';
import { LaunchpadProjectOutputDto, LaunchpadStatus, ProjectStatus } from './dto/launchpad.project.output.dto';
import { LaunchpadRoundEntity, LaunchpadRoundStatus, RoundType } from '../../database/entities/launchpad.rounds.entity';
import { ShowRoundsInput } from './dto/show.rounds.input.dto';
import { ShowRoundsOutput } from './dto/show.rounds.output.dto';
import { TokenStatisticService } from '../rgbpp/tokens/token.statistic.service';
import { MintCheckInputDto } from './dto/mint.check.input.dto';
import { IJwt } from '../../common/interface/jwt';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { MintCheckOutputDto, MintTransactionStatus } from './dto/mint.check.output.dto';
import { MintInputDto } from './dto/mint.token.input.dto';
import { BtcService } from '../btc/btc.service';
import { LaunchpadTransactionService } from './launchpad.transaction.service';
import { MintOutputDto, MintStatus } from './dto/mint.token.output.dto';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { In, Not } from 'typeorm';
import { TIME } from '../../common/utils/const.config';
import { StatusName } from '../../common/utils/error.code';
import { TokenStatus } from '../../database/entities/token.entity';
import { IssueStatus } from '../../database/entities/mint.history.entity';
import moment from 'moment';

@Injectable()
export class LaunchpadService {
    constructor(private readonly logger: AppLoggerService, private readonly launchpadTokensDbService: LaunchpadTokensDbService, private readonly tokenStatisticService: TokenStatisticService, private readonly appConfigService: AppConfigService, private readonly whitelistDbService: WhitelistDbService, private readonly mintHistotyDbService: MintHistotyDbService, private readonly launchpadTransactionService: LaunchpadTransactionService, private readonly btcService: BtcService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(LaunchpadService.name);
    }
    projectsCacheKey(ids: any) {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Launchpad:${ids.join('_')}{tag}`;
        }
    async getProjectsStatus(input: LaunchpadProjectInputDto): Promise<LaunchpadProjectOutputDto> {
            let { ids } = input;
            let key = this.projectsCacheKey(ids);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let launchpadTokenEntities = await this.launchpadTokensDbService.find({
                id: In(ids),
            }, { rounds: true });
            let list = launchpadTokenEntities.map((entity) => this.getLaunchpadStatus(entity));
            if (list.length > 0) {
                await this.redis.set(key, JSON.stringify({ list }), 'EX', TIME.ONE_SECOND);
            }
            return { list };
        }
    getLaunchpadStatus(entity: LaunchpadTokenEntity): LaunchpadStatus {
            let rounds = entity.rounds.sort((a, b) => a.roundIndex - b.roundIndex);
            let data;
            const now = moment().unix();
            for (let item of rounds) {
                if (item.status === LaunchpadRoundStatus.InProgress) {
                    let status = this.showRoundStatus(item, now);
                    return {
                        id: entity.id,
                        status,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        roundName: item.roundName,
                    };
                }
            }
            return data;
        }
    roundsCacheKey(tokenId: any) {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Launchpad:Rounds:${tokenId}{tag}`;
        }
    async showRounds(input: ShowRoundsInput): Promise<ShowRoundsOutput> {
            let { id } = input;
            let key = this.roundsCacheKey(id);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let entity = await this.launchpadTokensDbService.find({
                id: id,
            }, { rounds: true });
            if (entity.length === 0) {
                this.logger.warn(`[showRounds] entity not find ${id}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            const now = moment().unix();
            let rounds = entity[0].rounds
                .sort((a, b) => a.roundIndex - b.roundIndex)
                .map((round) => {
                let status = this.showRoundStatus(round, now);
                return {
                    roundId: round.id,
                    roundName: round.roundName,
                    roundIndex: round.roundIndex,
                    startTime: round.startTime,
                    endTime: round.endTime,
                    issueTime: round.issueTime,
                    roundSupply: round.roundSupply.div(round.amountPerMint),
                    mintedAmount: round.mintedAmount.div(round.amountPerMint),
                    isActive: round.status == LaunchpadRoundStatus.InProgress ? true : false,
                    status,
                    roundType: round.roundType,
                    whitelistLink: round.whitelistLink,
                    roundRate: round.roundRate
                        ? round.roundRate
                        : `${round.roundSupply.div(entity[0].totalSupply).mul(new Decimal(100))}%`,
                };
            });
            let tokenEntity;
            if (entity[0].xudtTypeHash) {
                tokenEntity = await this.tokenStatisticService.getTokenInfo({
                    xudtTypeHash: entity[0].xudtTypeHash,
                    status: TokenStatus.Listing,
                });
            }
            let data: any = {
                rounds,
                id: entity[0].id,
                symbol: entity[0].symbol,
                totalSupply: entity[0].totalSupply,
                totalIssued: entity[0].totalIssued,
                decimal: entity[0].decimal,
                xudtTypeHash: entity[0].xudtTypeHash,
                xudtArgs: entity[0].xudtArgs,
                tradable: tokenEntity ? true : false,
            };
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.ONE_SECOND);
            return data;
        }
    showRoundStatus(round: LaunchpadRoundEntity, now: number): ProjectStatus {
            let status = ProjectStatus.ComingSoon;
            if (round.startTime > 0 && round.startTime <= now) {
                status = ProjectStatus.LiveNow;
            }
            if (round.endTime > 0 && round.endTime < now) {
                status = ProjectStatus.Finished;
            }
            if (round.mintedAmount.greaterThanOrEqualTo(round.roundSupply)) {
                status = ProjectStatus.Finished;
            }
            return status;
        }
    async mintCheck(user: IJwt, input: MintCheckInputDto): Promise<MintCheckOutputDto> {
            const { address } = user;
            const { id, roundId } = input;
            let entity = await this.launchpadTokensDbService.find({
                id: id,
            }, { rounds: true });
            if (entity.length === 0) {
                this.logger.warn(`[mintCheck] entity not find ${id}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let round = entity[0].rounds.find((round) => round.id === roundId);
            if (!round) {
                this.logger.warn(`[mintCheck] round not find ${roundId}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            const mintStatus = await this.mintTransactionStatus(address, round);
            let data: any = { mintStatus };
            if (mintStatus === MintTransactionStatus.CanMint) {
                data.mintFee = this.appConfigService.rgbPPConfig.launchpadMintFee;
                data.paymasterAddress =
                    this.appConfigService.rgbPPConfig.launchpadPaymasterAddress;
                data.paymentAddress = round.paymentAddress;
                data.paymentAmount = round.paymentAmount
                    ? round.paymentAmount.toNumber()
                    : null;
                data.ckbCellCost = this.appConfigService.rgbPPConfig.ckbCellCost;
                data.amountPerMint = round.amountPerMint;
            }
            return data;
        }
    async mintTransactionStatus(address: string, round: LaunchpadRoundEntity): Promise<MintTransactionStatus> {
            let mintLimit = round.addressMintLimit;
            let mintStatus = MintTransactionStatus.CannotMint;
            let status = this.showRoundStatus(round, moment().unix());
            if (status === ProjectStatus.LiveNow) {
                switch (round.roundType) {
                    case RoundType.Whitelist:
                        let whitelistEntity = await this.whitelistDbService.findOne({
                            address,
                            launchpadRoundId: round.id,
                            launchpadTokenId: round.launchpadTokenId,
                        });
                        if (whitelistEntity) {
                            if (round.mintedAmount.lessThan(round.roundSupply)) {
                                mintStatus = MintTransactionStatus.CanMint;
                            }
                        }
                        break;
                    case RoundType.PublicMint:
                        if (round.mintedAmount.lessThan(round.roundSupply)) {
                            mintStatus = MintTransactionStatus.CanMint;
                        }
                        break;
                    default:
                        mintStatus = MintTransactionStatus.CannotMint;
                        break;
                }
            }
            let mintCount = await this.mintHistotyDbService.count({
                launchpadRoundId: round.id,
                launchpadTokenId: round.launchpadTokenId,
                address,
                status: Not(IssueStatus.MintFailed),
            });
            if (mintCount >= mintLimit) {
                mintStatus = MintTransactionStatus.Minted;
            }
            return mintStatus;
        }
    async mintToken(user: IJwt, input: MintInputDto): Promise<MintOutputDto> {
            const { address } = user;
            const { id, roundId, mintBtcTx } = input;
            let { mintStatus, paymasterAddress, mintFee: serviceFeeAmount, ckbCellCost, paymentAddress, paymentAmount, } = await this.mintCheck(user, {
                id,
                roundId,
            });
            if (mintStatus != MintTransactionStatus.CanMint) {
                this.logger.warn(`[mintToken] token can not mint ${id} ${roundId} mintStatus is ${mintStatus}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let [btcGasFeeInfo, entity] = await Promise.all([
                this.btcService.getFees(),
                this.launchpadTokensDbService.find({
                    id: id,
                }),
            ]);
            let { mintPsbt, txId } = await this.launchpadTransactionService.verifyMintPsbt(address, paymasterAddress, serviceFeeAmount + ckbCellCost, mintBtcTx, entity[0].xudtTypeHash, btcGasFeeInfo, paymentAddress, paymentAmount);
            let historyEntity = await this.mintHistotyDbService.initMintByTransaction(input, address, txId, roundId, paymasterAddress, serviceFeeAmount);
            if (!historyEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            historyEntity = await this.launchpadTransactionService.sendMintTransaction(mintPsbt, historyEntity);
            let status = historyEntity.status === IssueStatus.MintPending
                ? MintStatus.Pending
                : MintStatus.Failed;
            let key = this.roundsCacheKey(id);
            await this.redis.del(key);
            return {
                status,
                btcTransactionHash: txId,
            };
        }
}
