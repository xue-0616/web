import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { ActionService } from './action.service';
import { ActionGetResponseDto } from '../dto/action.output.dto';

@Controller('actions')
@ApiTags('actions')
export class ActionController {
    constructor(private readonly logger: AppLoggerService, private readonly actionService: ActionService) {
        this.logger.setContext(ActionController.name);
    }
    @Get('/create')
    @ApiOperation({ summary: 'create mystery box action' })
    @ApiResponse({
        type: ActionGetResponseDto,
    })
    createMysteryBoxAction(): ActionGetResponseDto {
            return this.actionService.createMysteryBoxAction();
        }
    @Get('/grab/:id')
    @ApiOperation({ summary: 'garb mystery box action' })
    @ApiResponse({
        type: ActionGetResponseDto,
    })
    async grabMysteryAction(@Param('id') redpacketId: bigint): Promise<ActionGetResponseDto> {
            return await this.actionService.grabMysteryBoxAction(redpacketId);
        }
}
