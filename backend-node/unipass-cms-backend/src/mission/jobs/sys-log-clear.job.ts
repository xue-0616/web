import { Injectable } from '@nestjs/common';
import { SysLogService } from '../../modules/admin/system/log/log.service';
import { Mission } from '../mission.decorator';

@Injectable()
@Mission()
export class SysLogClearJob {
    constructor(private readonly sysLogService: SysLogService) {}

    async clearLoginLog(): Promise<void> {
        await this.sysLogService.clearLoginLog();
    }

    async clearTaskLog(): Promise<void> {
        await this.sysLogService.clearTaskLog();
    }
}
