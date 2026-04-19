import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AdminGetUserCommandOutput, AuthenticationResultType, CognitoIdentityProviderClient, UserStatusType } from '@aws-sdk/client-cognito-identity-provider';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { CognitoResult } from './dto/login.output.dto';
import Redis from 'ioredis';
import { getAdminCreateUserCommand, getAdminGetUserCommand, getAdminInitiateAuthCommand, getAdminSetUserPasswordCommand } from '../../common/utils/aws.command';
import { StatusName } from '../../common/utils/error.code';
import { TIME } from '../../common/utils/time';

@Injectable()
export class AwsUserService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(AwsUserService.name);
        this.client = new CognitoIdentityProviderClient({
            region: this.appConfig.awsConfig.region,
            credentials: {
                accessKeyId: this.appConfig.awsConfig.accessKeyId,
                secretAccessKey: this.appConfig.awsConfig.secretAccessKey,
            },
        });
    }
    private client: any;
    async adminGetUser(tgUserId: number): Promise<AdminGetUserCommandOutput> {
            const userPoolId = this.appConfig.awsConfig.userPoolId;
            const adminGetUser = getAdminGetUserCommand(userPoolId, `${tgUserId}`);
            try {
                const data = await this.client.send(adminGetUser);
                this.logger.log(`[adminGetUser] email UserStatus = ${data.UserStatus}`);
                return data;
            }
            catch (error) {
                this.logger.warn(`[adminGetUser] ${error}`);
            }
        }
    async adminCreateUser(tgUserId: number): Promise<void> {
            const userPoolId = this.appConfig.awsConfig.userPoolId;
            const adminCreateUser = getAdminCreateUserCommand(userPoolId, `${tgUserId}`, `${tgUserId}`, this.appConfig.awsConfig.userPoolPassword);
            try {
                await this.client.send(adminCreateUser);
            }
            catch (error) {
                this.logger.warn(`[adminCreateUser]adminCreateUser ${error}`);
                throw new BadRequestException(StatusName.ServiceError);
            }
        }
    async adminSetUserPassword(tgUserId: number): Promise<void> {
            const userPoolId = this.appConfig.awsConfig.userPoolId;
            const adminSetUserPassword = getAdminSetUserPasswordCommand(userPoolId, `${tgUserId}`, this.appConfig.awsConfig.userPoolPassword);
            try {
                await this.client.send(adminSetUserPassword);
            }
            catch (error) {
                this.logger.warn(`[adminSetUserPassword] ${error}`);
                throw new BadRequestException(StatusName.ServiceError);
            }
        }
    async getInitiateAuthIdToken(tgUserId: number): Promise<AuthenticationResultType | undefined> {
            const clientId = this.appConfig.awsConfig.userPoolClientId;
            const userPoolId = this.appConfig.awsConfig.userPoolId;
            const secret = this.appConfig.awsConfig.userPoolClientSercet;
            const adminInitiateAuth = getAdminInitiateAuthCommand(clientId, userPoolId, `${tgUserId}`, this.appConfig.awsConfig.userPoolPassword, secret);
            let data;
            try {
                data = await this.client.send(adminInitiateAuth);
            }
            catch (error) {
                await this.adminSetUserPassword(tgUserId);
                return this.getInitiateAuthIdToken(tgUserId);
            }
            return data.AuthenticationResult;
        }
    getAwsUserCacahKey(tgUserId: any) {
            return `${this.appConfig.nodeEnv}:Solagram:AWS:User:$${tgUserId}{tag}`;
        }
    async getCognitoResult(tgUserId: number): Promise<CognitoResult> {
            let key = this.getAwsUserCacahKey(tgUserId);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return {
                    region: this.appConfig.awsConfig.region,
                    identityPoolId: this.appConfig.awsConfig.identityPoolId,
                    userPoolId: this.appConfig.awsConfig.userPoolId,
                    idToken: cacheData,
                    kmsKeyId: this.appConfig.awsConfig.kmsKeyId,
                };
            }
            let userData = await this.adminGetUser(tgUserId);
            const userStatus = userData ? userData.UserStatus : '';
            switch (userStatus) {
                case '':
                    await this.adminCreateUser(tgUserId);
                    await this.adminSetUserPassword(tgUserId);
                    break;
                case UserStatusType.FORCE_CHANGE_PASSWORD:
                    await this.adminSetUserPassword(tgUserId);
                    break;
                case UserStatusType.CONFIRMED:
                    break;
                default:
                    return undefined;
            }
            const data = await this.getInitiateAuthIdToken(tgUserId);
            if (data.IdToken) {
                await this.redis.set(key, data.IdToken, 'EX', TIME.HALF_HOUR);
            }
            const cognitoResult = {
                region: this.appConfig.awsConfig.region,
                identityPoolId: this.appConfig.awsConfig.identityPoolId,
                userPoolId: this.appConfig.awsConfig.userPoolId,
                idToken: data?.IdToken,
                kmsKeyId: this.appConfig.awsConfig.kmsKeyId,
            };
            return cognitoResult;
        }
}
