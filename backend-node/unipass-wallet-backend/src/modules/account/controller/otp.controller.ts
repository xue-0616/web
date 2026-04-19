import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces/Response';
import { SendCodeOutput, VerifyCodeOutput } from '../../otp/dtos';

@ApiTags('otp')
@Controller('otp')
@UseGuards(UpJwtGuard)
export class OtpController {
    constructor(otpService: any, logger: any, authenticatorsService: any, ipreCaptchaService: any) {
        this.otpService = otpService;
        this.logger = logger;
        this.authenticatorsService = authenticatorsService;
        this.ipreCaptchaService = ipreCaptchaService;
        this.logger.setContext(OtpController.name);
    }
    otpService: any;
    logger: any;
    authenticatorsService: any;
    ipreCaptchaService: any;
    @ApiOperation({ summary: 'send otp code' })
    @Post('send')
    @ApiResponse({ type: SwaggerBaseApiResponse(SendCodeOutput) })
    async send2FaCode(@Body() send2FaCodeInput: any, @Request() req: any) {
            this.logger.log(`[send2FaCode]isSendCode=${JSON.stringify(send2FaCodeInput)} ${req.ip} from ${req.user.email}`);
            const isSendCode = await this.authenticatorsService.isSendOtpCode(req.user, send2FaCodeInput, req.ip);
            const isSendPhone = this.authenticatorsService.isSendPhone(send2FaCodeInput);
            let isShowReCaptcha = false;
            if (isSendCode) {
                await this.otpService.sendCode(send2FaCodeInput, req.user);
                if (isSendPhone) {
                    await this.ipreCaptchaService.saveReCaptchaCache(req.ip);
                    isShowReCaptcha = await this.ipreCaptchaService.isNeedShowReCaptcha(req.ip);
                }
            }
            return { isShowReCaptcha };
        }
    @ApiOperation({ summary: 'verify 2fa otp code' })
    @Post('verify')
    @ApiResponse({ type: SwaggerBaseApiResponse(VerifyCodeOutput) })
    async verify2FaOtpCode(@Body() verifyOtp2FaCodeInput: any, @Request() req: any) {
            const { user: account } = req;
            const isSendVerify = await this.authenticatorsService.isSendVerify2FaData(account, verifyOtp2FaCodeInput);
            const data = await (isSendVerify
                ? this.otpService.verify2FaCode(verifyOtp2FaCodeInput, account)
                : this.authenticatorsService.verifyGoogleAuthenticator(account, verifyOtp2FaCodeInput));
            return data;
        }
}
