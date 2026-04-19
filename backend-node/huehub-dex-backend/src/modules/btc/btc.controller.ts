import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { OpenAccess } from '../../decorators/open.access.decorator';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BtcChainInfoOutput } from './dto/chain.info.dto';
import { BtcService } from './btc.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('Btc Module')
@Controller('btc')
export class BtcController {
    constructor(private readonly logger: AppLoggerService, private readonly btcService: BtcService) {
        this.logger.setContext(BtcController.name);
    }
    @ApiOperation({ summary: 'GetBtcChainInfo' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BtcChainInfoOutput) })
    @Get('chain/info')
    @OpenAccess()
    async getChainInfo(): Promise<BtcChainInfoOutput> {
            return await this.btcService.getBtcChainInfo();
        }
}
