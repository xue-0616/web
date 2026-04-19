import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiConfigService } from './api-config.service';
import { UpHttpService } from './up.http.service';

@Module({
        imports: [
            HttpModule.register({
                timeout: 60000,
                maxRedirects: 5,
            }),
        ],
        providers: [ApiConfigService, UpHttpService],
        exports: [ApiConfigService, UpHttpService],
    })
export class CommonModule {
}
