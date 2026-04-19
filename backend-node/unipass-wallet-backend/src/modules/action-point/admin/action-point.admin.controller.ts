import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';

@Controller('ap')
@ApiTags('ap-admin')
@UseGuards(AdminGuard)
export class ActionPointAdminController {
    constructor(issueService: any) {
        this.issueService = issueService;
    }
    issueService: any;
    @Post('admin/issue')
    async addressActionPoint(@Body() input: any) {
            const data = await this.issueService.addressActionPoint(input);
            return data;
        }
    @Post('admin/balance')
    async getActionPointBalance(@Body() input: any) {
            const data = await this.issueService.getActionPointBalance(input);
            return data;
        }
    @Post('admin/relayer/config')
    async initRelayerConfig(@Body() input: any) {
            return await this.issueService.initRelayerConfig(input);
        }
    @Post('admin/unlock')
    async unlockActionPoint(@Body() input: any) {
            return await this.issueService.unlockActionPoint(input);
        }
}
