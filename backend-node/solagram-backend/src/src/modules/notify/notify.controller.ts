import { Body, Controller, Post } from '@nestjs/common';
import { PublicRoute } from '../../decorators/public-route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BotNotifyInputDto } from './dto/bot-notify-input.dto';
import { NotifyService } from './notify.service';

@Controller('bot')
@ApiTags('bot')
export class NotifyController {
    constructor(private readonly logger: AppLoggerService, private readonly notifyService: NotifyService) {
        this.logger.setContext(NotifyController.name);
    }
    @Post('notify')
    @PublicRoute()
    async notify(@Body() input: BotNotifyInputDto): Promise<void> {
            return this.notifyService.notify(input);
        }
}
