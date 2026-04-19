import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BlinkShortCodeOutputDto } from './dto/blink.short.code.output.dto';
import { BlinkService } from './blink.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('blink')
@ApiTags('blink')
export class BlinkController {
    constructor(private readonly logger: AppLoggerService, private readonly blinkService: BlinkService) {
        this.logger.setContext(BlinkController.name);
    }
    @Get('/:shortCode')
    @ApiOperation({ summary: 'Retrieve URL by short code' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BlinkShortCodeOutputDto) })
    async getUrlByShortCode(@Param() param: {
        shortCode: string;
    }): Promise<BlinkShortCodeOutputDto> {
            return await this.blinkService.getUrlByShortCode(param.shortCode);
        }
}
