import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { BaseApiResponse, SwaggerBaseApiResponse } from '../../../interfaces';
import { GetNFTCollectionOutput, GetNFTImageUrlOutput, GetNFTOutput, GetOnRampUrlOutput } from '../dto';

@Controller('account')
@ApiTags('account')
@UseGuards(UpJwtGuard)
export class AccountAssetController {
    constructor(logger: any, nftService: any, accountRampService: any, unipassConfigService: any) {
        this.logger = logger;
        this.nftService = nftService;
        this.accountRampService = accountRampService;
        this.unipassConfigService = unipassConfigService;
        this.logger.setContext(AccountAssetController.name);
    }
    logger: any;
    nftService: any;
    accountRampService: any;
    unipassConfigService: any;
    @ApiOperation({ summary: 'update account chain sync status' })
    @Get('on.ramp.url')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetOnRampUrlOutput) })
    GetOnRampUrl(@Request() req: any, @Query() getOnRampUrlInput: any) {
            const data = this.accountRampService.getOnRampUrl(req.user, getOnRampUrlInput);
            return data;
        }
    @ApiOperation({ summary: 'get account nft collection' })
    @Get('nft/collection')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetNFTCollectionOutput) })
    async getAccountNFTCollectionList(@Query() getNFTInput: any, @Request() req: any) {
            const data = await this.nftService.getChainNFTCollectionList(getNFTInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'get account nft tokens' })
    @Get('nft/tokens')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetNFTOutput) })
    async getAccountNFTTokensList(@Query() getNFTTokenInput: any, @Request() req: any) {
            const data = await this.nftService.getCollectionTokenList(getNFTTokenInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'get account nft images' })
    @Get('nft/images')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetNFTImageUrlOutput) })
    async getNftImageUrl(@Query() getNFTImageUrlInput: any, @Request() req: any) {
            const data = await this.nftService.getNftImageUrl(getNFTImageUrlInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'get account erc20 tokens api' })
    @Post('erc20/tokens')
    @ApiResponse({ type: BaseApiResponse })
    async getAccountTokens(@Body() getAccountTokensInput: any) {
            const data = await this.unipassConfigService.getAccountErc20Tokens(getAccountTokensInput);
            return data;
        }
    @ApiOperation({ summary: 'get token cmc api return price' })
    @Post('token/price')
    @ApiResponse({ type: BaseApiResponse })
    async getPriceConversion(@Body() getPriceConversionInput: any) {
            const data = await this.unipassConfigService.getPriceConversion(getPriceConversionInput);
            return data;
        }
}
