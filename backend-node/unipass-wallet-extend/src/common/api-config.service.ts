import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getLogger } from './logger/logger.helper';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { isNil } from 'lodash';

@Injectable()
export class ApiConfigService {
    constructor(private configService: ConfigService) {
        this.logger = getLogger(ApiConfigService.name);
    }
    private logger: any;
    getNumber(key: any) {
            const value = this.get(key);
            try {
                return Number(value);
            }
            catch (error) {
                this.logger.error(`[getNumber] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                throw new Error(key + ' environment variable is not a number');
            }
        }
    getBoolean(key: any) {
            const value = this.get(key);
            try {
                return Boolean(JSON.parse(value));
            }
            catch (error) {
                this.logger.error(`[getBoolean] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                throw new Error(key + ' env var is not a boolean');
            }
        }
    getString(key: any) {
            const value = this.get(key);
            return value.replace(/\\n/g, '\n');
        }
    get mysqlMainnetConfig(): TypeOrmModuleOptions {
            const entities = [__dirname + '/../**/*.entity.{js,ts}'];
            return {
                entities,
                keepConnectionAlive: true,
                type: 'mysql',
                host: this.getString('DB_HOST'),
                port: this.getNumber('DB_PORT'),
                username: this.getString('DB_USERNAME'),
                password: this.getString('DB_PASSWORD'),
                database: this.getString('DB_DATABASE'),
                namingStrategy: new SnakeNamingStrategy(),
            };
        }
    get mysqlTestNetConfig(): TypeOrmModuleOptions {
            const entities = [__dirname + '/../**/*.entity.{js,ts}'];
            return {
                entities,
                keepConnectionAlive: true,
                type: 'mysql',
                host: this.getString('DB_HOST_TEST_NET'),
                port: this.getNumber('DB_PORT_TEST_NET'),
                username: this.getString('DB_USERNAME_TEST_NET'),
                password: this.getString('DB_PASSWORD_TEST_NET'),
                database: this.getString('DB_DATABASE_TEST_NET'),
                namingStrategy: new SnakeNamingStrategy(),
            };
        }
    get getWebhookConfig(): {
        fatPayPublicKey: string;
        fatPayPartnerId: string;
        slackWebHookUrl: string;
        appHost: string;
    } {
            return {
                fatPayPublicKey: this.getString('FAT_PAY_PUBLIC_KEY'),
                fatPayPartnerId: this.getString('FAT_PAY_PARTNER_Id'),
                slackWebHookUrl: this.getString('SLACK_WEB_HOOK_URL'),
                appHost: this.getString('APP_HOST'),
            };
        }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value)) {
                throw new Error(key + ' environment variable does not set');
            }
            return value;
        }
}
