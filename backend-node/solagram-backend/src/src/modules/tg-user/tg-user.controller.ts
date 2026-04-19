import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { LoginOutputDto } from './dto/login.output.dto';
import { LoginInputDto } from './dto/login.input.dto';
import { TgUserService } from './tg-user.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('user')
@ApiTags('user')
export class TgUserController {
    constructor(private readonly logger: AppLoggerService, private readonly tgUserService: TgUserService) {
        this.logger.setContext(TgUserController.name);
    }
    @Post('auth')
    @ApiOperation({ summary: 'mini app login' })
    @ApiResponse({ type: SwaggerBaseApiResponse(LoginOutputDto) })
    async auth(@Body() input: LoginInputDto): Promise<LoginOutputDto> {
            return await this.tgUserService.auth(input);
        }
}
