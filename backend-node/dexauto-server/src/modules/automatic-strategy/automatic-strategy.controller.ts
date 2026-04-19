import { Controller, Get, Post, UseGuards, Request, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger } from 'nestjs-pino';
import { AutomaticStrategyService } from './automatic-strategy.service';
import { CreateAutomaticStrategyDto } from './dto/create.dto';
import { AutomaticStrategiesResponse, AutomaticStrategyEventsResponse, AutomaticStrategyResponse, AutomaticStrategyUnsoldEventsResponse, ChainFMChannelInfoResponse } from './dto/response.dto';
import { UpdateAutomaticStrategyDto } from './dto/update.dto';
import { AutomaticStrategyEventsRequestDto } from './dto/events.dto';
import { ChainFMChannelInfoRequestDto } from './dto/chainFM.dto';
import { PinoLogger } from 'nestjs-pino';
import { AutomaticStrategyUnsoldEventsRequestDto } from './dto/unsold-events.dto';
import { buildSuccessResponse } from '../../common/dto/response';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/v1/automatic-strategy')
export class AutomaticStrategyController {
    private automaticStrategyService: AutomaticStrategyService;
    private logger: PinoLogger;

    constructor(
        automaticStrategyService: AutomaticStrategyService,
        @InjectPinoLogger(AutomaticStrategyController.name) logger: PinoLogger,
    ) {
        this.automaticStrategyService = automaticStrategyService;
        this.logger = logger;
    }

    @Post('create')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategyResponse })
    async create(@Request() req: any, @Body() createAutomaticStrategyDto: CreateAutomaticStrategyDto): Promise<AutomaticStrategyResponse> {
        const userId = req.userId;
        const automaticStrategy = await this.automaticStrategyService.createAutomaticStrategy(userId, createAutomaticStrategyDto);
        this.logger.info(`create automatic strategy success`);
        return buildSuccessResponse(automaticStrategy);
    }
    @Get('/detail/:id')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategyResponse })
    async detail(@Request() req: any, @Param('id') id: string): Promise<AutomaticStrategyResponse> {
        const userId = req.userId;
        const automaticStrategy = await this.automaticStrategyService.getAutomaticStrategy(userId, id);
        this.logger.info(`get automatic strategy success: id=${id}`);
        return buildSuccessResponse(automaticStrategy);
    }
    @Get('list')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategiesResponse })
    async list(@Request() req: any): Promise<AutomaticStrategiesResponse> {
        const userId = req.userId;
        const automaticStrategies = await this.automaticStrategyService.automaticStrategies(userId);
        this.logger.info(`get automatic strategies success`);
        return buildSuccessResponse(automaticStrategies);
    }
    @Post('update')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategyResponse })
    async update(@Request() req: any, @Body() updateAutomaticStrategyDto: UpdateAutomaticStrategyDto): Promise<AutomaticStrategyResponse> {
        const userId = req.userId;
        const automaticStrategy = await this.automaticStrategyService.updateAutomaticStrategy(userId, updateAutomaticStrategyDto);
        this.logger.info(`updateAutomaticStrategy success`);
        return buildSuccessResponse(automaticStrategy);
    }
    @Post('events')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategyEventsResponse })
    async events(@Request() req: any, @Body() eventsRequestDto: AutomaticStrategyEventsRequestDto): Promise<AutomaticStrategyEventsResponse> {
        const userId = req.userId;
        const events = await this.automaticStrategyService.getAutomaticStrategyEvents(userId, eventsRequestDto);
        this.logger.info(`getAutomaticStrategyEvents success: ${events}`);
        return buildSuccessResponse(events);
    }
    @Post('/unsold/events')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: AutomaticStrategyUnsoldEventsResponse })
    async unsoldEvents(@Request() req: any, @Body() eventsRequestDto: AutomaticStrategyUnsoldEventsRequestDto): Promise<AutomaticStrategyUnsoldEventsResponse> {
        const userId = req.userId;
        const events = await this.automaticStrategyService.getAutomaticStrategyUnsoldEvents(userId, eventsRequestDto);
        this.logger.info(`getAutomaticStrategyUnsoldEvents success`);
        return buildSuccessResponse(events);
    }
    @Post('chainCM/channel')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiResponse({ type: ChainFMChannelInfoResponse })
    async chainFMChannelInfo(@Body() chainFMChannelReq: ChainFMChannelInfoRequestDto): Promise<ChainFMChannelInfoResponse> {
        const res = await this.automaticStrategyService.getChainFMChannelInfo(chainFMChannelReq.url);
        this.logger.info(`get chainFMChannelInfo success: name=${res.name}`);
        return buildSuccessResponse(res);
    }
}
