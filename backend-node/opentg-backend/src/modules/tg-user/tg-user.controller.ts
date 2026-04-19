import { AppLoggerService } from '../../common/utils-service/logger.service';
import { PointsInputDto } from './dto/points-input.dto';
import { PointsOutputDto } from './dto/points-output.dto';
import { TgUserService } from './tg-user.service';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User Module')
@Controller('user')
export class TgUserController {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly tgUserService: TgUserService,
    ) {
        this.logger.setContext(TgUserController.name);
    }

    @Post('points')
    async showPoints(@Body() input: PointsInputDto): Promise<PointsOutputDto> {
        return this.tgUserService.showPoints(input);
    }
}
