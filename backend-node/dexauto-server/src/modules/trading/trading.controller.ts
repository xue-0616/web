import { TradingSettingResponse, TradingSettingsResponse } from './dto/setting.response.dto';
import { UpdateSettingDto } from './dto/updateSetting.dto';
import { TradingService } from './trading.service';
import { DeleteTradingStrategyResponse, TradingStrategiesResponse, TradingStrategyResponse } from './dto/strategy.response.dto';
import { UpdateStrategyDto } from './dto/updateStrategy.dto';
import { DeleteStrategyDto } from './dto/deleteStrategy.dto';
import { CreateStrategyDto } from './dto/createStrategy.dto';
import { CancelOrderDto, CreateOrderDto, GetOrdersReqDto } from './dto/order.dto';
import { TradingOrderResponse, TradingOrdersResponse } from './dto/order.response.dto';
import { PinoLogger } from 'nestjs-pino';
import { buildSuccessResponse } from '../../common/dto/response';
import { BadRequestException } from '../../error';
import Decimal from 'decimal.js';
import { Controller, Get, Post, UseGuards, Request, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { InjectPinoLogger } from 'nestjs-pino';
import { web3 } from '@coral-xyz/anchor';
import { isNullOrUndefined } from '../../common/utils';

@Controller('api/v1/trading')
@ApiTags('trading')
export class TradingController {
    private tradingService: TradingService;
    private logger: PinoLogger;

    constructor(
        tradingService: TradingService,
        @InjectPinoLogger(TradingController.name) logger: PinoLogger,
    ) {
        this.tradingService = tradingService;
        this.logger = logger;
    }

    @Get('settings')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingSettingsResponse })
    async settings(@Request() req: any): Promise<TradingSettingsResponse> {
        const userId = req.userId;
        const settings = await this.tradingService.tradingSettings(userId);
        this.logger.info(`get trading settings: ${settings}`);
        return buildSuccessResponse(settings);
    }
    @Post('setting/update')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingSettingResponse })
    async updateSetting(@Request() req: any, @Body() updateSettingDto: UpdateSettingDto): Promise<TradingSettingResponse> {
        const userId = req.userId;
        const { id, isMevEnabled, slippagePercent, priorityFee, briberyAmount } = updateSettingDto;
        let parsedPriorityFee = null;
        try {
            if (priorityFee !== null) {
                parsedPriorityFee = BigInt(priorityFee);
            }
        }
        catch {
            throw new BadRequestException('invalid priority fee');
        }
        let parsedBriberyAmount = null;
        try {
            if (briberyAmount !== null) {
                parsedBriberyAmount = BigInt(briberyAmount);
            }
        }
        catch {
            throw new BadRequestException('invalid bribery amount');
        }
        let parsedSlippage = null;
        try {
            if (slippagePercent !== null) {
                parsedSlippage = new Decimal(slippagePercent).div(100);
            }
        }
        catch {
            throw new BadRequestException('invalid slippage');
        }
        if (parsedSlippage !== null && parsedSlippage.gt(1)) {
            throw new BadRequestException('slippage percent cannot exceed 100%');
        }
        if (parsedSlippage !== null && parsedSlippage.lt(0)) {
            throw new BadRequestException('slippage percent cannot be negative');
        }
        const setting = await this.tradingService.updateSetting(userId, id, isMevEnabled, parsedSlippage, parsedPriorityFee, parsedBriberyAmount);
        this.logger.info(`update trading setting: ${setting}`);
        return buildSuccessResponse(setting);
    }
    @Get('strategies')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingStrategiesResponse })
    async strategies(@Request() req: any): Promise<TradingStrategiesResponse> {
        const userId = req.userId;
        const strategies = await this.tradingService.tradingStrategies(userId);
        this.logger.info(`get trading strategies: ${strategies}`);
        return buildSuccessResponse(strategies);
    }
    @Post('strategy/update')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingStrategyResponse })
    async updateStrategy(@Request() req: any, @Body() updateStrategyDto: UpdateStrategyDto): Promise<TradingStrategyResponse> {
        const userId = req.userId;
        const strategies = await this.tradingService.updateStrategy(userId, updateStrategyDto);
        this.logger.info(`update trading strategy: ${strategies}`);
        return buildSuccessResponse(strategies);
    }
    @Post('strategy/delete')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: DeleteTradingStrategyResponse })
    async deleteStrategy(@Request() req: any, @Body() deleteStrategyDto: DeleteStrategyDto): Promise<DeleteTradingStrategyResponse> {
        const userId = req.userId;
        await this.tradingService.deleteStrategy(userId, deleteStrategyDto);
        this.logger.info(`delete trading strategy: ${deleteStrategyDto.id}`);
        return buildSuccessResponse(null);
    }
    @Post('strategy/create')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingStrategyResponse })
    async createStrategy(@Request() req: any, @Body() createStrategyDto: CreateStrategyDto): Promise<TradingStrategyResponse> {
        const userId = req.userId;
        const strategy = await this.tradingService.createStrategy(userId, createStrategyDto);
        this.logger.info(`create trading strategy: ${strategy}`);
        return buildSuccessResponse(strategy);
    }
    @Post('order/create')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingOrderResponse })
    async createOrder(@Request() req: any, @Body() createOrderDto: CreateOrderDto): Promise<TradingOrderResponse> {
        const { orderType, amount: amountStr, outAmount: outAmountStr, isAntiMev, slippagePercent, priorityFee: priorityFeeStr, briberyAmount: briberyAmountStr, pool: poolStr, walletId, triggerPriceUsd: triggerPriceUsdStr, autoTradeEventId: autoTradeEventIdStr, } = createOrderDto;
        const userId = req.userId;
        let pool;
        try {
            pool = isNullOrUndefined(poolStr)
                ? null
                : new web3.PublicKey(poolStr!);
        } catch {
            throw new BadRequestException('invalid pool address');
        }
        let amount;
        try {
            amount = BigInt(amountStr);
        } catch {
            throw new BadRequestException('invalid amount');
        }
        if (amount <= 0n) {
            throw new BadRequestException('amount must be positive');
        }
        let outAmount;
        try {
            outAmount = isNullOrUndefined(outAmountStr)
                ? null
                : BigInt(outAmountStr!);
        } catch {
            throw new BadRequestException('invalid out amount');
        }
        let slippage;
        try {
            slippage = new Decimal(slippagePercent).div(100);
            if (slippage.gt(1)) {
                throw new BadRequestException('slippage percent cannot exceed 100%');
            }
            if (slippage.lt(0)) {
                throw new BadRequestException('slippage percent cannot be negative');
            }
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw new BadRequestException('invalid slippage');
        }
        let priorityFee;
        try {
            priorityFee = BigInt(priorityFeeStr);
        } catch {
            throw new BadRequestException('invalid priority fee');
        }
        let briberyAmount;
        try {
            briberyAmount = BigInt(briberyAmountStr);
        } catch {
            throw new BadRequestException('invalid bribery amount');
        }
        const triggerPriceUsd = isNullOrUndefined(triggerPriceUsdStr)
            ? null
            : new Decimal(triggerPriceUsdStr!);
        const autoTradeEventId = isNullOrUndefined(autoTradeEventIdStr)
            ? null
            : autoTradeEventIdStr;
        const order = await this.tradingService.createOrder(orderType, userId, walletId, pool, amount, outAmount, slippage, priorityFee, briberyAmount, isAntiMev, triggerPriceUsd, autoTradeEventId);
        this.logger.info(`create trading order: ${order}`);
        return buildSuccessResponse(order);
    }
    @Get('order/detail/:id')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingOrderResponse })
    async getOrderDetail(@Request() req: any, @Param('id') id: string): Promise<TradingOrderResponse> {
        const userId = req.userId;
        const order = await this.tradingService.getOrderDetail(userId, id);
        return buildSuccessResponse(order);
    }
    @Post('orders')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingOrdersResponse })
    async getOrders(@Request() req: any, @Body() getOrders: GetOrdersReqDto): Promise<TradingOrdersResponse> {
        const userId = req.userId;
        const { pool, startId, statuses, orderTypes, orderBy, tokenMint, limit } = getOrders;
        const orders = await this.tradingService.getOrders(userId, isNullOrUndefined(pool) ? null : pool, isNullOrUndefined(tokenMint) ? null : tokenMint, isNullOrUndefined(statuses) ? null : statuses, isNullOrUndefined(orderTypes) ? null : orderTypes, isNullOrUndefined(startId) ? null : startId, isNullOrUndefined(orderBy) ? null : orderBy, isNullOrUndefined(limit) ? null : limit);
        this.logger.info(`get trading orders: ${orders}`);
        return buildSuccessResponse(orders);
    }
    @Post('order/cancel')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: TradingOrderResponse })
    async cancelOrder(@Request() req: any, @Body() cancelOrder: CancelOrderDto): Promise<TradingOrderResponse> {
        const userId = req.userId;
        const order = await this.tradingService.cancelOrder(userId, cancelOrder.id);
        this.logger.info(`cancel trading order: ${order}`);
        return buildSuccessResponse(order);
    }
}
