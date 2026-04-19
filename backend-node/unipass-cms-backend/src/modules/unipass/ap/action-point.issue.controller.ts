import { Controller, Post, Body } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGetActionPointBalanceInput, IssueActionPointInput } from '../../../modules/unipass/dto/issue.ap.input';
import { ActionPointIssueService } from '../../../modules/unipass/ap/action-point.issue.service';
import { AdminGetActionPointBalanceOutput, IssueActionPointOutput } from '../../../modules/unipass/dto/issue.ap.output';
import { ADMIN_PREFIX } from '../../admin/admin.constants';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('UniPass')
@Controller('ap')
export class ActionPointController {
    constructor(private readonly issueService: ActionPointIssueService) {}

    @Post('issue')
    async issueActionPoint(@Body() input: IssueActionPointInput): Promise<IssueActionPointOutput> {
        return this.issueService.issueActionPoint(input);
    }

    @Post('balance')
    async getActionPointBalance(@Body() input: AdminGetActionPointBalanceInput): Promise<AdminGetActionPointBalanceOutput> {
        return this.issueService.getActionPointBalance(input);
    }
}
