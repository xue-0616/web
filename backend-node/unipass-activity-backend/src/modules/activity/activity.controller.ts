import { Body, Controller, Post } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../interfaces';
import { GetMintOutput, GetShortKeyClaimOutput, GetShortKeyOutput } from './dto/universe.output.dto';

@Controller('')
@ApiTags('universe')
export class ActivityController {
    constructor(activityService: any) {
        this.activityService = activityService;
    }
    activityService: any;
    @Post('/universe/mint')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetMintOutput) })
    async getMintToken(@Body() input: any) {
            const data = await this.activityService.getMintToken(input);
            return data;
        }
    @Post('/universe/short.key')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetShortKeyOutput) })
    async getShortKey(@Body() input: any) {
            const data = await this.activityService.getShortKey(input);
            return data;
        }
    @Post('/universe/claim')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetShortKeyClaimOutput) })
    async getShortTx(@Body() input: any) {
            const data = await this.activityService.getShortClaim(input);
            return data;
        }
}
