import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { ActionInputDto, ActionParamInputDto } from './dto/action.input.dto';
import { ActionOutputDto } from './dto/action.output.dto';
import { GarbActionParamInputDto } from './dto/grab.action.input.dto';
import { TransactionService } from './transaction.service';

@Controller('mystery')
@ApiTags('mystery')
export class MysteryBoxController {
    constructor(private readonly logger: AppLoggerService, private readonly transactionService: TransactionService) {
        this.logger.setContext(MysteryBoxController.name);
    }
    @Post('/create/:amount/:bombNumber')
    @ApiOperation({ summary: 'createMysteryBoxTransaction' })
    @ApiResponse({
        type: ActionOutputDto,
    })
    async createMysteryBoxTransaction(@Body() input: ActionInputDto, @Param() param: ActionParamInputDto): Promise<ActionOutputDto> {
            return await this.transactionService.createMysteryBoxTransaction(param, input);
        }
    @Post('/grab/:id')
    @ApiOperation({ summary: 'grabMysteryBoxs' })
    @ApiResponse({
        type: ActionOutputDto,
    })
    async grabMysteryBoxsTransaction(@Body() input: ActionInputDto, @Param() param: GarbActionParamInputDto): Promise<ActionOutputDto> {
            return await this.transactionService.grabMysteryBoxsTransaction(param, input);
        }
}
