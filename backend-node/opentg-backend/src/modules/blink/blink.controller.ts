import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BlinkService } from './blink.service';
import { BlinkListOutput } from './dto/blink.list.output.dto';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('blink')
@ApiTags('Blink')
export class BlinkController {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly blinkService: BlinkService,
    ) {
        this.logger.setContext(BlinkService.name);
    }

    @Get('list')
    @ApiOperation({ summary: 'show trusted blink action domain' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BlinkListOutput) })
    async getAllTrustedHost(): Promise<BlinkListOutput> {
        return await this.blinkService.getAllTrustedHost();
    }
}
