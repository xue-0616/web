import { OpenAccess } from '../../decorators/open.access.decorator';
import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CollectionsInfoInput, CollectionsInput } from './dto/collections.input.dto';
import { CollectionInfoDto, CollectionOutputDto } from './dto/collections.output.dto';
import { ItemsInputDto } from './dto/items.input.dto';
import { ItemListOutputDto } from './dto/items.output.dto';
import { ListItemsInputDto } from './dto/list.items.input.dto';
import { ListItemsOutputDto } from './dto/list.items.output.dto';
import { BuyItemsInputDto, ItemPSBTInputDto } from './dto/buy.tems.input.dto';
import { BuyItemsOutputDto, ItemPSBTOutputDto } from './dto/buy.items.output.dto';
import { UnlistItemsInputDto } from './dto/unlist.items.input.dto';
import { UnlistItemsOutputDto } from './dto/unlist.items.output.dto';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { RequestContext } from '../../common/interface/request.context';
import { MyOrdersOutput } from './dto/my.orders.output.dto';
import { MyOrdersInput } from './dto/my.orders.input.dto';
import { ActivitiesOutputDto } from './dto/activities.output.dto';
import { ActivitiesInputDto } from './dto/activities.input.dto';
import { CollectionService } from './collection.service';
import { MarketService } from '../market/market.service';
import { CollectionDbService } from './db.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('Dobs Module')
@Controller('collections')
export class DobsController {
    constructor(private readonly logger: AppLoggerService, private readonly collectionService: CollectionService, private readonly marketService: MarketService, private readonly collectionDbService: CollectionDbService) {
        this.logger.setContext(DobsController.name);
    }
    @OpenAccess()
    @Get('')
    @ApiOperation({ summary: 'Query collections' })
    @ApiResponse({ type: SwaggerBaseApiResponse(CollectionOutputDto) })
    async collections(@Query() query: CollectionsInput): Promise<CollectionOutputDto> {
            return await this.collectionService.collections(query);
        }
    @OpenAccess()
    @Get('info')
    @ApiOperation({ summary: 'Get collection info' })
    @ApiResponse({ type: SwaggerBaseApiResponse(CollectionInfoDto) })
    async collectionInfo(@Query() query: CollectionsInfoInput): Promise<CollectionInfoDto> {
            return await this.collectionService.collectionInfo(query);
        }
    @OpenAccess()
    @Get('items')
    @ApiOperation({ summary: 'Show nft items' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ItemListOutputDto) })
    async items(@Query() query: ItemsInputDto): Promise<ItemListOutputDto> {
            let { clusterTypeHash, sort, page, limit } = query;
            let collection = await this.collectionService.queryOneCollection(clusterTypeHash);
            return await this.marketService.items(collection, sort, page, limit);
        }
    @Post('item/list')
    @ApiOperation({ summary: 'List nft' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ListItemsOutputDto) })
    async listItems(@Request() ctx: RequestContext, @Body() input: ListItemsInputDto): Promise<ListItemsOutputDto> {
            let clusterTypeHash = input.items[0].clusterTypeHash;
            let collection = await this.collectionService.queryOneCollection(clusterTypeHash);
            let data = await this.marketService.listItems(ctx.user, input, collection);
            await this.collectionDbService.updateCollectionFloorPrice(collection);
            return data;
        }
    @Post('item/get_psbt')
    @ApiOperation({ summary: 'Get psbt' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ItemPSBTOutputDto) })
    async getItemPSBT(@Body() itemPSBTInput: ItemPSBTInputDto): Promise<ItemPSBTOutputDto> {
            return await this.marketService.getItemPSBT(itemPSBTInput);
        }
    @Post('item/buy')
    @ApiOperation({ summary: 'Buy items' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BuyItemsOutputDto) })
    async buyItems(@Request() ctx: RequestContext, @Body() buyItemsInput: BuyItemsInputDto): Promise<BuyItemsOutputDto> {
            const { data, collectionId } = await this.marketService.buyItem(ctx.user, buyItemsInput);
            await this.collectionService.queryOneCollection(null, collectionId, true);
            return data;
        }
    @Post('item/unlist')
    @ApiOperation({ summary: 'Unlist items' })
    @ApiResponse({ type: SwaggerBaseApiResponse(UnlistItemsOutputDto) })
    async unlistItems(@Request() ctx: RequestContext, @Body() unlistItemInput: UnlistItemsInputDto): Promise<UnlistItemsOutputDto> {
            const { data, collectionId } = await this.marketService.unlistItems(ctx.user, unlistItemInput);
            await this.collectionService.queryOneCollection(null, collectionId, true);
            return data;
        }
    @Get('orders')
    @ApiOperation({ summary: 'My nft orders' })
    @ApiResponse({ type: SwaggerBaseApiResponse(MyOrdersOutput) })
    async queryOrders(@Request() ctx: RequestContext, @Query() myOrdersInput: MyOrdersInput): Promise<MyOrdersOutput> {
            const { clusterTypeHash } = myOrdersInput;
            let collection;
            if (clusterTypeHash) {
                collection =
                    await this.collectionService.queryOneCollection(clusterTypeHash);
            }
            return await this.marketService.queryOrders(ctx.user, myOrdersInput, collection);
        }
    @Get('activities')
    @ApiOperation({ summary: 'NFT activities' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ActivitiesOutputDto) })
    @OpenAccess()
    async getActivities(@Query() activityInput: ActivitiesInputDto): Promise<ActivitiesOutputDto> {
            const { clusterTypeHash } = activityInput;
            const collection = await this.collectionService.queryOneCollection(clusterTypeHash);
            return await this.marketService.getActivities(collection, activityInput);
        }
}
