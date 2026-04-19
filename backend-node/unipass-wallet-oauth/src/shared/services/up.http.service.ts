// Recovered from dist/up.http.service.js.map (source: ../../../src/shared/services/up.http.service.ts)
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { sleep } from '../utils';
import { AppLoggerService } from './logger.service';

@Injectable()
export class UpHttpService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly httpService: HttpService,
  ) {}

  async httpPost(url: string, params: any = {}, config: any = {}, sendTimes = 1): Promise<any> {
    this.logger.log(`[httpPost] ${url}`);
    try {
      const result = await firstValueFrom(this.httpService.post(url, params, config));
      return result?.data;
    } catch (error: any) {
      const isNeedResend = await this.isNeedResend(error?.message, sendTimes);
      if (isNeedResend) {
        return await this.httpPost(url, params, config, sendTimes + 1);
      }
      this.logger.error(`[httpPost] error ${error}`, { url, params, config });
      return undefined;
    }
  }

  async isNeedResend(errorMessage?: string, sendTimes = 1): Promise<boolean> {
    if (sendTimes > 2) {
      return false;
    }
    if (errorMessage === 'Request failed with status code 429') {
      this.logger.log(`${errorMessage} sleep(500) ms sendTimes = ${sendTimes}`);
      await sleep(500);
      return true;
    }
    return false;
  }
}
