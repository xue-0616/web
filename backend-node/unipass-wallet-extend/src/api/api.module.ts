import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AccountModule } from '../account/account.module';
import { ApiService } from './api.service';
import { WebhookService } from './webhook/webhook.service';
import { APIController } from './api.controller';
import { WebhookController } from './webhook/webhook.controller';

@Module({
        imports: [CommonModule, AccountModule],
        providers: [ApiService, WebhookService],
        controllers: [APIController, WebhookController],
    })
export class ApiModule {
}
