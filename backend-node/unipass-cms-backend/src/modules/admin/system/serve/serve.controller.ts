import { Controller, Get } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ServeStatInfo } from './serve.class';
import { SysServeService } from './serve.service';
import { PermissionOptional } from '../../core/decorators/permission-optional.decorator';
import { ADMIN_PREFIX } from '../../admin.constants';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('服务监控')
@Controller('serve')
export class SysServeController {
    constructor(private readonly serveService: SysServeService) {}

    @ApiOperation({ summary: '获取服务器运行信息' })
    @ApiOkResponse({ type: ServeStatInfo })
    @PermissionOptional()
    @Get('stat')
    async stat(): Promise<ServeStatInfo> {
        return this.serveService.getServeStat();
    }
}
