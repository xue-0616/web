import { Controller, Post, UseGuards, Request, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageNotifierService } from './message-notifier.service';
import { NotifierRegisterResponse, NotifiesResponse } from './dto/response.dto';
import { NotifierRegisterDto } from './dto/register.dto';
import { NotifiesQueryDto } from './dto/notifies.dto';
import { buildSuccessResponse } from '../../common/dto/response';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('notifier')
@Controller('api/v1/notifier')
export class MessageNotifierController {
    private messageNotifierService: MessageNotifierService;

    constructor(messageNotifierService: MessageNotifierService) {
        this.messageNotifierService = messageNotifierService;
    }

    @Post('register')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ status: 200, type: NotifierRegisterResponse })
    async register(@Request() req: any, @Body() registerDto: NotifierRegisterDto): Promise<NotifierRegisterResponse> {
        const userId = req.userId;
        await this.messageNotifierService.addFirebaseToken(userId, registerDto.token);
        return buildSuccessResponse(undefined);
    }
    @Post('notifies')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ status: 200, type: NotifiesResponse })
    async getNotifies(@Request() req: any, @Body() query: NotifiesQueryDto): Promise<NotifiesResponse> {
        const userId = req.userId;
        const notifies = await this.messageNotifierService.getNotifies(userId, query.startId ?? null, query.limit ?? null);
        return buildSuccessResponse(notifies);
    }
}
