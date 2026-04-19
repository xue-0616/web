import { Controller, Get, Post, Query, Param, Body, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger } from 'nestjs-pino';
import { TokenService } from './token.service';
import { TimeInterval, TimeRange } from './constants/time-range.enum';
import { TokenConfigurationResponse } from './dto/configuration.dto';
import { PinoLogger } from 'nestjs-pino';
import { buildSuccessResponse } from '../../common/dto/response';
import { web3 } from '@coral-xyz/anchor';

/** Maximum number of results that can be returned in a single query */
const MAX_QUERY_LIMIT = 100;

/**
 * Validate that a string is a valid Solana base58 public key.
 * Throws BadRequestException if invalid.
 */
function validateMintAddress(address: string, paramName = 'mintAddress'): void {
    if (!address || typeof address !== 'string') {
        throw new BadRequestException(`${paramName} is required`);
    }
    try {
        new web3.PublicKey(address);
    } catch {
        throw new BadRequestException(`Invalid ${paramName}: must be a valid base58 Solana address`);
    }
}

/**
 * Clamp a user-supplied limit to [1, MAX_QUERY_LIMIT].
 */
function clampLimit(limit: number, defaultValue: number): number {
    const n = Number(limit) || defaultValue;
    return Math.max(1, Math.min(n, MAX_QUERY_LIMIT));
}

/** Maximum allowed time range for a single history query (90 days in seconds). */
const MAX_TIME_RANGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * Validate a (startTime, endTime) pair. Both must be positive Unix-second
 * integers, ordered, and the range must not exceed MAX_TIME_RANGE_SECONDS.
 * Without this check a user could request 100 years of 1-minute candles and
 * trigger an OOM on the ClickHouse node.
 */
function validateTimeRange(startTime: number, endTime: number): void {
    const start = Number(startTime);
    const end = Number(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
        throw new BadRequestException('startTime and endTime must be non-negative numbers');
    }
    if (end <= start) {
        throw new BadRequestException('endTime must be strictly greater than startTime');
    }
    if (end - start > MAX_TIME_RANGE_SECONDS) {
        throw new BadRequestException(
            `time range too large: maximum ${MAX_TIME_RANGE_SECONDS} seconds (~90 days)`,
        );
    }
}

@Controller('api/v1/token')
@ApiTags('Token')
export class TokenController {
    private tokenService: TokenService;
    private logger: PinoLogger;

    constructor(
        tokenService: TokenService,
        @InjectPinoLogger(TokenController.name) logger: PinoLogger,
    ) {
        this.tokenService = tokenService;
        this.logger = logger;
    }

    @Get('trending')
    @ApiOperation({ summary: '获取热门代币' })
    @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getTrendingTokens(@Query('timeRange') timeRange = TimeRange.MINS_5): Promise<any> {
        const tokens = await this.tokenService.getTrendingTokensWithCache(timeRange);
        return buildSuccessResponse(tokens);
    }
    @Get('search')
    @ApiOperation({ summary: '代币查询' })
    @ApiQuery({ name: 'symbol', type: String, required: true })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    async getTokenBySymbol(@Query('symbol') symbol: string, @Query('limit') limit = 20): Promise<any> {
        const clampedLimit = clampLimit(limit, 20);
        const tokens = await this.tokenService.getTokensInfoBySymbol(symbol, clampedLimit);
        return buildSuccessResponse(tokens);
    }
    @Get('searchByAddress')
    @ApiOperation({ summary: '代币查询' })
    @ApiQuery({ name: 'address', type: String, required: true })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    async getTokenByAddress(@Query('address') address: string, @Query('limit') limit = 20): Promise<any> {
        const clampedLimit = clampLimit(limit, 20);
        const tokens = await this.tokenService.getTokensInfoByAddress(address, clampedLimit);
        return buildSuccessResponse(tokens);
    }
    @Get('holdersNumber')
    @ApiOperation({ summary: '获取头部持仓地址' })
    @ApiQuery({ name: 'mint', type: String, required: true })
    async getTokenHoldersNumber(@Query('mint') mint: string): Promise<any> {
        validateMintAddress(mint, 'mint');
        const topHolders = await this.tokenService.getTokenHoldersNumber(mint);
        return buildSuccessResponse(topHolders);
    }
    @Get('holders')
    @ApiOperation({ summary: '获取头部持仓地址' })
    @ApiQuery({ name: 'mint', type: String, required: true })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    async getTokenTopHolders(@Query('mint') mint: string, @Query('limit') limit = 100): Promise<any> {
        validateMintAddress(mint, 'mint');
        const clampedLimit = clampLimit(limit, 100);
        const topHolders = await this.tokenService.getTokenTopHolders(mint, clampedLimit);
        return buildSuccessResponse(topHolders);
    }
    @Get('configurations')
    @ApiResponse({ type: TokenConfigurationResponse })
    async configurations(): Promise<TokenConfigurationResponse> {
        const config = await this.tokenService.configurations();
        this.logger.info(`${JSON.stringify(config)}`);
        return buildSuccessResponse(config);
    }
    @Get(':mintAddress')
    @ApiOperation({ summary: '获取代币信息' })
    @ApiQuery({ name: 'pool', type: String, required: false })
    async getTokenInfo(@Param('mintAddress') mintAddress: string, @Query('pool') poolAddress?: string): Promise<any> {
        validateMintAddress(mintAddress);
        if (poolAddress) {
            validateMintAddress(poolAddress, 'pool');
        }
        const tokenInfo = await this.tokenService.getTokenInfoByMint(mintAddress, poolAddress);
        return buildSuccessResponse(tokenInfo);
    }
    @Post('price')
    @ApiOperation({ summary: '查询代币历史价格' })
    async getTokenPrice(@Body('mintAddress') mintAddress: string, @Body('poolAddress') poolAddress: string, @Body('startTime') startTime: number, @Body('endTime') endTime: number, @Body('interval') interval = 1): Promise<any> {
        validateMintAddress(mintAddress);
        validateMintAddress(poolAddress, 'poolAddress');
        // DoS protection — bound the ClickHouse scan window. Previously a caller
        // could request a 100-year 1-minute candle window and OOM the analytics DB.
        validateTimeRange(startTime, endTime);
        const tokenPrice = await this.tokenService.getTokenPrice(mintAddress, poolAddress, startTime, endTime, interval);
        return buildSuccessResponse(tokenPrice);
    }
    @Post('trades')
    @ApiOperation({ summary: '获取代币交易记录' })
    async getTokenTrades(@Body('mintAddress') mintAddress: string, @Body('poolAddress') poolAddress: string, @Body('startTime') startTime: number, @Body('limit') limit = 100, @Body('offset') offset = 0): Promise<any> {
        validateMintAddress(mintAddress);
        validateMintAddress(poolAddress, 'poolAddress');
        // Validate startTime and offset bounds to avoid unbounded ClickHouse scans.
        const start = Number(startTime);
        if (!Number.isFinite(start) || start < 0) {
            throw new BadRequestException('startTime must be a non-negative number');
        }
        const offsetNum = Number(offset);
        if (!Number.isFinite(offsetNum) || offsetNum < 0 || offsetNum > 10_000) {
            throw new BadRequestException('offset must be between 0 and 10000');
        }
        const clampedLimit = clampLimit(limit, 100);
        const tokenTrades = await this.tokenService.getTokenTrades(mintAddress, poolAddress, start, clampedLimit, offsetNum);
        return buildSuccessResponse(tokenTrades);
    }
}
