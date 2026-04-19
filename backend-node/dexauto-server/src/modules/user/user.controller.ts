import { Controller, Get, Post, UseGuards, Request, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger } from 'nestjs-pino';
import { LoginDto } from './dto/login.dto';
import { UserService } from './user.service';
import { UserAuthResponse, UserInfoResponse, UserLoginResponse } from './dto/response.dto';
import { PinoLogger } from 'nestjs-pino';
import { UpdateLanguageDto } from './dto/updateLanguageCode.dto';
import { UserAuthDto } from './dto/auth.dto';
import { buildSuccessResponse } from '../../common/dto/response';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('user')
@Controller('api/v1/user')
export class UserController {
    private userService: UserService;
    private logger: PinoLogger;

    constructor(
        userService: UserService,
        @InjectPinoLogger(UserController.name) logger: PinoLogger,
    ) {
        this.userService = userService;
        this.logger = logger;
    }

    @Post('login')
    @ApiResponse({ description: 'login success', status: 200, type: UserLoginResponse })
    async login(@Body() loginDto: LoginDto): Promise<UserLoginResponse> {
        const ret = await this.userService.login(loginDto);
        this.logger.info('login success');
        return buildSuccessResponse(ret);
    }
    @Get('info')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ status: 200, type: UserInfoResponse })
    async info(@Request() req: any): Promise<UserInfoResponse> {
        const userId = req.userId;
        const ret = await this.userService.userInfo(userId);
        this.logger.info(`user info: ${ret}`);
        return buildSuccessResponse(ret);
    }
    @Post('language/update')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ status: 200, type: UserInfoResponse })
    async updateLanguageCode(@Request() req: any, @Body() body: UpdateLanguageDto): Promise<UserInfoResponse> {
        const userId = req.userId;
        const userInfo = await this.userService.updateLanguage(userId, body.language);
        this.logger.info(`update language success: ${userInfo}`);
        return buildSuccessResponse(userInfo);
    }
    @Post('auth')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ status: 200, type: UserAuthResponse })
    async auth(@Body() body: UserAuthDto): Promise<UserAuthResponse> {
        const ret = await this.userService.auth(body.userAddr);
        this.logger.info(`auth success: ${ret}`);
        return buildSuccessResponse(ret);
    }
}
