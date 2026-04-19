import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PublicRoute } from '../../decorators/public-route.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { SolanaService } from './solana.service';
import { TokenInfoOutput } from './dto/show-token-info.output.dto';
import { ShowTokenInfoInputDto } from './dto/show-token-info.input.dto';
import { AddressTransfersInputDto } from './dto/address-transfers.input.dto';
import { AddressTransfersOutput } from './dto/address-transfers.output.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('solana')
@ApiTags('Solana')
export class SolanaController {
    constructor(private readonly logger: AppLoggerService, private readonly solanaService: SolanaService) {
        this.logger.setContext(SolanaController.name);
    }
    @Post('/token')
    @PublicRoute()
    @ApiOperation({ summary: 'Get Token Info' })
    @ApiResponse({
        type: SwaggerBaseApiResponse(TokenInfoOutput),
    })
    async getTokenInfo(@Body() input: ShowTokenInfoInputDto): Promise<TokenInfoOutput> {
            return await this.solanaService.getTokenInfo(input);
        }
    @Get('/transfers')
    @PublicRoute()
    @ApiOperation({ summary: 'Get Address Transfers' })
    @ApiResponse({
        type: SwaggerBaseApiResponse(AddressTransfersOutput),
    })
    async getAddressTransfers(@Query() input: AddressTransfersInputDto): Promise<AddressTransfersOutput> {
            return await this.solanaService.getAddressTransfers(input);
        }
}
