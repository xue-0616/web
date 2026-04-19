import { Body, Controller, Post } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ADMIN_PREFIX } from '../../admin/admin.constants';
import { DkimService } from '../../../modules/unipass/monitor/dkim.service';
import { OpenIdService } from '../../../modules/unipass/monitor/open.id.service';
import { IStatisticsDto } from '../../../modules/unipass/dto/unipass.dto';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('Monitor')
@Controller('monitor')
export class MonitorController {
    constructor(
        private readonly openIdService: OpenIdService,
        private readonly dkimService: DkimService,
    ) {}

    @Post('openId')
    async getOpenIdInfo(@Body() dto: IStatisticsDto): Promise<any> {
        return this.openIdService.getOpenIdInfoData(dto);
    }

    @Post('dkim')
    async getDkimInfo(@Body() dto: IStatisticsDto): Promise<any> {
        return this.dkimService.getDkimInfo(dto);
    }
}
