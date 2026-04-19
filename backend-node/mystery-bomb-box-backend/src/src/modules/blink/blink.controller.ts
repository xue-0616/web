import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BlinkListInputDto } from './dto/blink.list.input.dto';
import { BlinkOutputDto } from './dto/blink.list.output.dto';
import { BlinkService } from './blink.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('blink')
@ApiTags('blink')
export class BlinkController {
    constructor(private readonly logger: AppLoggerService, private readonly blinkService: BlinkService) {
        this.logger.setContext(BlinkController.name);
    }
    @Get('/list')
    @ApiOperation({ summary: 'blink list' })
    @ApiResponse({
        type: SwaggerBaseApiResponse(BlinkOutputDto),
    })
    async queryBlinkList(@Query() input: BlinkListInputDto): Promise<BlinkOutputDto> {
            return await this.blinkService.queryBlinkList(input);
        }
}
