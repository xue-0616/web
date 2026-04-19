import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { OpenAccess } from '../../decorators/open.access.decorator';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { UserService } from './user.service';
import { GetNonceInput, GetNonceOutput } from './dto/get.nonce.dto';
import { UserLoginInput, UserLoginOutput } from './dto/user.login.dto';
import { AssetsInputDto } from './dto/assets.input.dto';
import { AssetsOutputDto } from './dto/assets.output.dto';
import { RequestContext } from '../../common/interface/request.context';
import { BtcAssetsOutputDto } from './dto/btc.assets.output.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('User Module')
@Controller('user')
export class UserController {
    constructor(private readonly logger: AppLoggerService, private readonly userService: UserService) {
        this.logger.setContext(UserController.name);
    }
    @ApiOperation({ summary: 'Get User Nonce' })
    @ApiResponse({ type: SwaggerBaseApiResponse(GetNonceOutput) })
    @Get('nonce')
    @OpenAccess()
    async getUserNonce(@Query() input: GetNonceInput): Promise<GetNonceOutput> {
            return await this.userService.getUserNonce(input);
        }
    @ApiOperation({ summary: 'Login' })
    @ApiResponse({ type: SwaggerBaseApiResponse(UserLoginOutput) })
    @Post('login')
    @OpenAccess()
    async login(@Body() input: UserLoginInput): Promise<UserLoginOutput> {
            return await this.userService.login(input);
        }
    @Post('assets/rgbpp')
    @ApiOperation({ summary: 'Rgbpp Assets' })
    @ApiResponse({ type: SwaggerBaseApiResponse(AssetsOutputDto) })
    async RgbppAssets(@Request() ctx: RequestContext, @Body() input: AssetsInputDto): Promise<AssetsOutputDto> {
            return await this.userService.getRgbppAssetsByUser(ctx.user, input);
        }
    @Post('assets/btc')
    @ApiOperation({ summary: 'Btc Assets' })
    @ApiResponse({ type: SwaggerBaseApiResponse(BtcAssetsOutputDto) })
    async btcAssets(@Request() ctx: RequestContext): Promise<BtcAssetsOutputDto> {
            return await this.userService.getBtcAssets(ctx.user);
        }
}
