import { Controller, Get, Post, Query, Body, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { UtilService } from '../../../shared/services/util.service';
import { ImageCaptchaDto, LoginInfoDto } from './login.dto';
import { ImageCaptcha, LoginToken } from './login.class';
import { LoginService } from './login.service';
import { Authorize } from '../core/decorators/authorize.decorator';
import { LogDisabled } from '../core/decorators/log-disabled.decorator';

@ApiTags('登录模块')
@Controller()
export class LoginController {
    constructor(
        private readonly loginService: LoginService,
        private readonly utils: UtilService,
    ) {}

    @ApiOperation({ summary: '获取登录图片验证码' })
    @ApiOkResponse({ type: ImageCaptcha })
    @Get('captcha/img')
    @Authorize()
    async captchaByImg(@Query() dto: ImageCaptchaDto): Promise<ImageCaptcha> {
        return this.loginService.createImageCaptcha(dto);
    }

    @ApiOperation({ summary: '管理员登录' })
    @ApiOkResponse({ type: LoginToken })
    @Post('login')
    @LogDisabled()
    @Authorize()
    async login(@Body() dto: LoginInfoDto, @Req() req: FastifyRequest, @Headers('user-agent') ua: string): Promise<LoginToken> {
        await this.loginService.checkImgCaptcha(dto.captchaId, dto.verifyCode);
        const token = await this.loginService.getLoginSign(dto.username, dto.password, this.utils.getReqIP(req), ua);
        return { token };
    }
}
