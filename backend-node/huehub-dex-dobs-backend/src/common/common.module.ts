import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppConfigService } from './utils.service/app.config.services';
import { AppLoggerService } from './utils.service/logger.service';
import { MyHttpService } from './utils.service/http.service';
import { RedlockService } from './utils.service/redlock.service';

@Module({
        imports: [HttpModule],
        providers: [
            AppConfigService,
            AppLoggerService,
            MyHttpService,
            RedlockService,
        ],
        exports: [AppConfigService, AppLoggerService, MyHttpService, RedlockService],
    })
export class CommonModule {
}
