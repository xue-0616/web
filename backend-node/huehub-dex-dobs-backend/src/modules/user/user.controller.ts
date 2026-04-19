import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { AssetsInputDto } from './dto/assets.input.dto';
import { AssetsOutputDto } from './dto/assets.output.dto';
import { RequestContext } from '../../common/interface/request.context';
import { UserService } from './user.service';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('User Module')
@Controller('user')
export class UserController {
    constructor(private readonly logger: AppLoggerService, private readonly userService: UserService) {
        this.logger.setContext(UserController.name);
    }
    @Post('assets/dobs')
    @ApiOperation({ summary: 'Dobs Assets' })
    @ApiResponse({ type: SwaggerBaseApiResponse(AssetsOutputDto) })
    async getDobsAssets(@Request() ctx: RequestContext, @Body() input: AssetsInputDto): Promise<AssetsOutputDto> {
            return await this.userService.getDobsAssets(ctx.user, input);
        }
}
