import { Controller, Post, Body, Req, Request } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IStatisticsDto } from '../../../modules/unipass/dto/unipass.dto';
import { OrderService } from '../../../modules/unipass/order/order.service';
import { PaginatedResponseDto } from '../../../common/class/res.class';
import { FatPayOrderOutput } from '../../../modules/unipass/dto/fat-pay.order.output';
import { RequestContext } from '../../../modules/unipass/order/utils';
import { Authorize } from '../../admin/core/decorators/authorize.decorator';
import { ADMIN_PREFIX } from '../../admin/admin.constants';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('order')
@Controller('order')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post('fatpay/list')
    async getUnipassUserDbInfo(@Body() dto: IStatisticsDto): Promise<PaginatedResponseDto<FatPayOrderOutput>> {
        return this.orderService.getFatPayOrderUrl(dto);
    }

    @Post('fat-pay/webhook')
    @Authorize()
    getFatPayOrderWebhook(@Req() req: any, @Body() body: any): boolean {
        return this.orderService.getFatPayOrderWebhook(req.headers, body);
    }
}
