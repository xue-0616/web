import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { MiniAppActionInputDto } from './dto/mini-app-action.input.dto';
import { TgUserService } from './tg-user.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('app')
@ApiTags('app')
export class MiniAppController {
    constructor(private readonly logger: AppLoggerService, private readonly tgUserService: TgUserService) {
        this.logger.setContext(MiniAppController.name);
    }
    @Post('action')
    @ApiOperation({ summary: 'record mini app action' })
    @ApiResponse({ type: SwaggerBaseApiResponse(undefined) })
    async recordMiniAppAction(@Body() input: MiniAppActionInputDto): Promise<void> {
            return await this.tgUserService.recordMiniAppAction(input);
        }
}
