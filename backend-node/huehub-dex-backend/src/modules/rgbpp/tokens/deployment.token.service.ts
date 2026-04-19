import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { DeploymentTokenEntity, DeploymentTokenStatus } from '../../../database/entities/deployment.token.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { TokensInput } from '../dto/tokens.input.dto';
import { TokenEntity } from '../../../database/entities/token.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import Redis from 'ioredis';
import { TokenStatisticService } from './token.statistic.service';

@Injectable()
export class DeploymentTokenService {
    constructor(@InjectRedis() private readonly redis: Redis, private readonly logger: AppLoggerService, @InjectRepository(DeploymentTokenEntity) private deploymentTokenEntity: Repository<DeploymentTokenEntity>) {
        this.logger.setContext(TokenStatisticService.name);
    }
    async getAllValidDeployToken(query: TokensInput, tokenIds: number[]): Promise<TokenEntity[]> {
            let builder = this.deploymentTokenEntity
                .createQueryBuilder('deployment_tokens')
                .where('status in (:status)', {
                status: [
                    DeploymentTokenStatus.DeployTokenBtcSuccess,
                    DeploymentTokenStatus.DeployTokenSuccess,
                ],
            });
            if (tokenIds) {
                builder.andWhere('deployment_tokens.tokenId in (:tokenIds)', {
                    tokenIds,
                });
            }
            builder.leftJoinAndSelect('deployment_tokens.token', 'token');
            let list = await builder.getMany();
            return list.map((x) => {
                let token = x.token;
                delete (x as any).token;
                token.deploymentToken = x;
                return token;
            });
        }
    async findOne(where: FindOptionsWhere<DeploymentTokenEntity>): Promise<DeploymentTokenEntity | null> {
            return await this.deploymentTokenEntity.findOne({ where });
        }
}
