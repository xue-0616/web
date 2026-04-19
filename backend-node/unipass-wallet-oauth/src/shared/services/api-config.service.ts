// Recovered from dist/api-config.service.js.map (source: ../../../src/shared/services/api-config.service.ts)
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { isNil } from 'lodash';
import * as cacheManagerRedisStore from 'cache-manager-redis-store';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AppLoggerService } from './logger.service';

@Injectable()
export class ApiConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  get nodeEnv(): string {
    return this.getString('NODE_ENV');
  }

  get fallbackLanguage(): string {
    return this.getString('FALLBACK_LANGUAGE').toLowerCase();
  }

  get mysqlConfig(): Record<string, unknown> {
    const entities = [__dirname + '/../../modules/**/*.entity{.ts,.js}'];
    const migrations = [__dirname + '/../../database/migrations/*{.ts,.js}'];
    return {
      entities,
      migrations,
      keepConnectionAlive: true,
      type: 'mysql',
      host: this.getString('DB_HOST'),
      port: this.getNumber('DB_PORT'),
      username: this.getString('DB_USERNAME'),
      password: this.getString('DB_PASSWORD'),
      database: this.getString('DB_DATABASE'),
      migrationsRun: true,
      logging: this.getBoolean('ENABLE_ORM_LOGS'),
      namingStrategy: new SnakeNamingStrategy(),
    };
  }

  get redisConfig(): Record<string, unknown> {
    return {
      store: cacheManagerRedisStore,
      url: this.getString('REDIS_URL'),
      ttl: this.getNumber('REDIS_TTL'),
      auth_pass: this.getString('REDIS_PASSWORD'),
    };
  }

  get queueConfig(): Record<string, unknown> {
    return {
      redis: {
        host: this.getString('REDIS_HOST'),
        port: this.getNumber('REDIS_PORT'),
        db: this.getNumber('REDIS_DB'),
        password: this.getString('REDIS_PASSWORD'),
      },
    };
  }

  get documentationEnabled(): boolean {
    return this.getBoolean('ENABLE_DOCUMENTATION');
  }

  get authConfig(): Record<string, unknown> {
    return {
      jwtSecret: this.getString('JWT_SECRET_KEY'),
      jwtExpirationTime: this.getNumber('JWT_EXPIRATION_TIME'),
    };
  }

  get getOtpConfig(): Record<string, unknown> {
    return {
      minOtpCode: this.getNumber('MIN_OTPCODE_INTERVAL'),
      mailFrom: this.getString('MAIL_FROM'),
      subjectPrefix: this.getString('MAIL_SUBJECT_PREFIX'),
      maxTime: this.getNumber('SEND_MAX_TIME'),
      maxVerifyTime: this.getNumber('VERIFY_MAX_TIME'),
      showCaptcha: this.getNumber('SHOW_CAPTCHA_TIMES'),
      ipMaxRequest: this.getNumber('MAX_IP_SEND_TIMES'),
    };
  }

  get getSendGridConfig(): Record<string, unknown> {
    return {
      apikey: this.getString('SENDGRID_API_KEY'),
    };
  }

  get appConfig(): Record<string, unknown> {
    return {
      port: this.getString('PORT'),
      rateLimit: this.getNumber('RATE_Limit'),
      isMainNet: this.getBoolean('IS_MAIN_NET'),
    };
  }

  get jwtConfig(): Record<string, unknown> {
    return {
      secret: this.getString('JWT_SECRET_KEY'),
      signOptions: {
        expiresIn: this.getString('JWT_EXPIRESIN'),
      },
    };
  }

  get auth0Config(): Record<string, unknown> {
    return {
      authODomain: this.getString('AUTH0_DOMAIN'),
    };
  }

  get getGoogelConfig(): Record<string, unknown> {
    return {
      siteKey: this.getString('GOOGLE_SITE_KEY'),
    };
  }

  get(key: string): string {
    const value = this.configService.get<string>(key);
    if (isNil(value)) {
      throw new Error(key + ' environment variable does not set');
    }
    return value;
  }

  getNumber(key: string): number {
    const value = Number(this.get(key));
    if (Number.isNaN(value)) {
      this.logger.error(`${key} environment variable is not a number`);
      throw new Error(key + ' environment variable is not a number');
    }
    return value;
  }

  getBoolean(key: string): boolean {
    const value = this.get(key);
    try {
      return Boolean(JSON.parse(value));
    } catch (error) {
      this.logger.error(`[getBoolean] ${error}`);
      throw new Error(key + ' env var is not a boolean');
    }
  }

  getString(key: string): string {
    const value = this.get(key);
    return value.replace(/\\n/g, '\n');
  }
}
