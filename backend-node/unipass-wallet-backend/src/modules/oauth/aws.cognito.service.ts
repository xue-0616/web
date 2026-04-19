import { BadRequestException, Injectable } from '@nestjs/common';
import { CognitoIdentityProviderClient, UserStatusType } from '@aws-sdk/client-cognito-identity-provider';
import { getAdminCreateUserCommand, getAdminGetUserCommand, getAdminInitiateAuthCommand, getAdminSetUserPasswordCommand } from './utils/aws.command';

@Injectable()
export class AWSService {
    constructor(logger: any, config: any) {
        this.logger = logger;
        this.config = config;
        this.logger.setContext(AWSService.name);
        this.client = new CognitoIdentityProviderClient({
            region: this.config.awsConfig.region,
            credentials: {
                accessKeyId: this.config.awsConfig.accessKey,
                secretAccessKey: this.config.awsConfig.secretAccessKey,
            },
        });
    }
    logger: any;
    config: any;
    client: any;
    async adminGetUser(email: any) {
            const userPoolId = this.config.awsConfig.userPoolId;
            const adminGetUser = getAdminGetUserCommand(userPoolId, email.toLocaleLowerCase());
            try {
                const data = await this.client.send(adminGetUser);
                this.logger.log(`[adminGetUser] email UserStatus = ${data.UserStatus}`);
                return data;
            }
            catch (error) {
                this.logger.warn(`[adminGetUser] ${error}`);
                return undefined;
            }
        }
    async adminCreateUser(email: any, password: any) {
            const userPoolId = this.config.awsConfig.userPoolId;
            const adminCreateUser = getAdminCreateUserCommand(userPoolId, email.toLocaleLowerCase(), email.toLocaleLowerCase(), `_${password}_`);
            try {
                await this.client.send(adminCreateUser);
            }
            catch (error) {
                this.logger.warn(`[adminCreateUser]adminCreateUser ${error}`);
                throw new BadRequestException();
            }
        }
    async adminSetUserPassword(email: any, password: any) {
            const userPoolId = this.config.awsConfig.userPoolId;
            const adminSetUserPassword = getAdminSetUserPasswordCommand(userPoolId, email.toLocaleLowerCase(), password);
            try {
                await this.client.send(adminSetUserPassword);
            }
            catch (error) {
                this.logger.warn(`[adminSetUserPassword] ${error}`);
                throw new BadRequestException();
            }
        }
    async getInitiateAuthIdToken(email: any, password: any): Promise<any> {
            const clientId = this.config.awsConfig.userPoolClientId;
            const userPoolId = this.config.awsConfig.userPoolId;
            const secret = this.config.awsConfig.userPoolClientSecret;
            const adminInitiateAuth = getAdminInitiateAuthCommand(clientId, userPoolId, email.toLocaleLowerCase(), password, secret);
            let data;
            try {
                data = await this.client.send(adminInitiateAuth);
            }
            catch (error) {
                this.logger.warn(`[getInitiateAuthIdToken] ${error}`);
                await this.adminSetUserPassword(email, password);
                return this.getInitiateAuthIdToken(email, password);
            }
            return data.AuthenticationResult;
        }
    async getUserPoolIdToken(email: any) {
            const password = this.config.awsConfig.userPoolPassword;
            let userData = await this.adminGetUser(email);
            const userStatus = userData ? userData.UserStatus : '';
            switch (userStatus) {
                case '':
                    await this.adminCreateUser(email, password);
                    await this.adminSetUserPassword(email, password);
                    break;
                case UserStatusType.FORCE_CHANGE_PASSWORD:
                    await this.adminSetUserPassword(email, password);
                    break;
                case UserStatusType.CONFIRMED:
                    break;
                default:
                    return undefined;
            }
            const data = await this.getInitiateAuthIdToken(email, password);
            const idToken = data === null || data === void 0 ? void 0 : data.IdToken;
            this.logger.log(`[getUserPoolIdToken]email: ${email} idToken = ${idToken}`);
            userData = await this.adminGetUser(email);
            const sub = `aws|email|${userData === null || userData === void 0 ? void 0 : userData.Username}`;
            const cognitoResult = {
                region: this.config.awsConfig.region,
                identityPoolId: this.config.awsConfig.identityPoolId,
                userPoolId: this.config.awsConfig.userPoolId,
                idToken: data === null || data === void 0 ? void 0 : data.IdToken,
                kmsKeyId: this.config.awsConfig.kmsKeyId,
            };
            return { cognitoResult, sub };
        }
}
