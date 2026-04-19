import { OpenAccess } from '../../decorators/open.access.decorator';
import { Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TokensInfoInput, TokensInput } from './dto/tokens.input.dto';
import { TokenInfoDto, TokensOutputDto } from './dto/tokens.output.dto';
import { ItemsInputDto } from './dto/items.input.dto';
import { ItemListOutputDto } from './dto/items.output.dto';
import { ListItemsInputDto } from './dto/list-items.input.dto';
import { ListItemsOutputDto } from './dto/list-items.output.dto';
import { BuyItemsInputDto, ItemPSBTInputDto } from './dto/buy-items.input.dto';
import { BuyItemsOutputDto, ItemPSBTOutputDto } from './dto/buy-items.output.dto';
import { UnlistItemsInputDto } from './dto/unlist-items.input.dto';
import { UnlistItemsOutputDto } from './dto/unlist-items.output.dto';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { TokensService } from './tokens/tokens.service';
import { OrderService } from './order/order.service';
import { RequestContext } from '../../common/interface/request.context';
import { MyOrdersOutput } from './dto/my-orders.output.dto';
import { MyOrdersInput } from './dto/my-orders.input.dto';
import { ActivitiesInputDto } from './dto/activities.input.dto';
import { ActivitiesOutputDto } from './dto/activities.output.dto';
import { HolderListOutputDto } from './dto/holders.output.dto';
import { HoldersInputDto } from './dto/holders.input.dto';
import { OrderPendingOutputDto } from './dto/order.pending.output.dto';
import { OrderPendingInputDto } from './dto/order.pending.input.dto';
import { TokensStatisticInput } from './dto/tokens-statistic.input.dto';
import { TokensStatisticOutputDto } from './dto/tokens-statistic.output.dto';
import { CkbDeployerCellProviderService } from '../ckb/ckb-deploy-cell-provider.service';
import { SearchTokensInput } from './dto/search.tokens.input.dto';
import { SearchTokensOutput } from './dto/search.tokens.output.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('RGB++ Module')
@Controller('rgbpp')
export class RgbppController {
    constructor(private readonly logger: AppLoggerService, private readonly tokenService: TokensService, private readonly orderService: OrderService, private readonly ckbCkbDeployerCellProviderService: CkbDeployerCellProviderService) {
        this.logger.setContext(RgbppController.name);
    }
    @OpenAccess()
    @Get('tokens')
    @ApiOperation({ summary: 'query tokens' })
    @ApiResponse({ type: SwaggerBaseApiResponse(TokensOutputDto) })
    async tokens(@Query() query: TokensInput): Promise<TokensOutputDto> {
            return await this.tokenService.getAllTokens(query);
        }
    @OpenAccess()
    @Get('tokens/search')
    @ApiOperation({ summary: 'search Tokens' })
    @ApiResponse({ type: SwaggerBaseApiResponse(SearchTokensOutput) })
    async searchTokens(@Query() searchTokensInput: SearchTokensInput): Promise<SearchTokensOutput> {
            return await this.tokenService.searchTokens(searchTokensInput);
        }
    @OpenAccess()
    @Get('token/info')
    @ApiOperation({ summary: 'get token info' })
    @ApiResponse({ type: SwaggerBaseApiResponse(TokenInfoDto) })
    async tokenInfo(@Query() query: TokensInfoInput): Promise<TokenInfoDto> {
            return await this.tokenService.getTokenInfoById(query);
        }
    @OpenAccess()
    @Get('items')
    @ApiOperation({ summary: 'get rgb++ items by token' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ItemListOutputDto) })
    async items(@Query() query: ItemsInputDto): Promise<ItemListOutputDto> {
            return await this.orderService.getItemsByToken(query);
        }
    @Post('item/list')
    @ApiOperation({ summary: 'rgb++ list' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ListItemsOutputDto) })
    async listItems(@Body() listItemsInput: ListItemsInputDto): Promise<ListItemsOutputDto> {
            return await this.orderService.listItems(listItemsInput);
        }
    @Post('item/get_psbt')
    @ApiOperation({ summary: 'rgb++ get_psbt' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ItemPSBTOutputDto) })
    async getItemPSBT(@Body() itemPSBTInput: ItemPSBTInputDto): Promise<ItemPSBTOutputDto> {
            return await this.orderService.getItemPSBT(itemPSBTInput);
        }
    @Post('item/buy')
    @ApiOperation({ summary: 'buy items' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BuyItemsOutputDto) })
    async buyItems(@Request() ctx: RequestContext, @Body() buyItemsInput: BuyItemsInputDto): Promise<BuyItemsOutputDto> {
            return await this.orderService.buyItem(ctx.user, buyItemsInput);
        }
    @Post('item/unlist')
    @ApiOperation({ summary: 'unlist items' })
    @ApiResponse({ type: SwaggerBaseApiResponse(UnlistItemsOutputDto) })
    async unlistItems(@Request() ctx: RequestContext, @Body() unlistItemInput: UnlistItemsInputDto): Promise<UnlistItemsOutputDto> {
            return await this.orderService.unlistItem(ctx.user, unlistItemInput);
        }
    @Get('orders')
    @ApiOperation({ summary: 'My orders' })
    @ApiResponse({ type: SwaggerBaseApiResponse(MyOrdersOutput) })
    async queryOrders(@Request() ctx: RequestContext, @Query() myOrdersInput: MyOrdersInput): Promise<MyOrdersOutput> {
            return await this.orderService.queryOrders(ctx.user, myOrdersInput);
        }
    @Get('order/fix/:id')
    @ApiOperation({ summary: 'fix order status' })
    @ApiResponse({})
    async fixOrder(@Request() ctx: RequestContext, @Param('id') itemId: number): Promise<{
        status: import("./rgbpp.service").RGBPPTransactionStatus;
        ckbTxHash: string;
    } | null> {
            return await this.orderService.fixOrderStatus(itemId);
        }
    @Get('activities')
    @ApiOperation({ summary: 'Token Activities' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ActivitiesOutputDto) })
    @OpenAccess()
    async getActivities(@Query() activityInput: ActivitiesInputDto): Promise<ActivitiesOutputDto> {
            return await this.tokenService.getActivities(activityInput);
        }
    @Get('token/holders')
    @ApiOperation({ summary: 'Token holders' })
    @ApiResponse({ type: SwaggerBaseApiResponse(HolderListOutputDto) })
    @OpenAccess()
    async getHolders(@Query() holderInput: HoldersInputDto): Promise<HolderListOutputDto> {
            return await this.tokenService.getHolders(holderInput);
        }
    @Get('order/pending')
    @ApiOperation({ summary: 'get pending activity' })
    @ApiResponse({ type: SwaggerBaseApiResponse(OrderPendingOutputDto) })
    @OpenAccess()
    async getOrderPending(@Query() activitiesPending: OrderPendingInputDto): Promise<OrderPendingOutputDto> {
            return await this.tokenService.getOrderPending(activitiesPending);
        }
    @Get('token/statics')
    @ApiOperation({ summary: 'Token statics' })
    @ApiResponse({ type: SwaggerBaseApiResponse(TokensStatisticOutputDto) })
    @OpenAccess()
    async getTokenStaticsList(@Query() tokenStatisticInput: TokensStatisticInput): Promise<TokensStatisticOutputDto> {
            return await this.tokenService.getTokenStaticsList(tokenStatisticInput);
        }
    @Get('split/cells')
    async splitSells(): Promise<void> {
            await this.ckbCkbDeployerCellProviderService.generateCandidateCells();
            return;
        }
}
