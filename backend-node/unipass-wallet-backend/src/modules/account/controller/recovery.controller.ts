import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { BaseApiResponse, SwaggerBaseApiResponse } from '../../../interfaces';
import { QueryRecoveryOutput } from '../dto';

@Controller('account')
@ApiTags('account')
@UseGuards(UpJwtGuard)
export class RecoveryController {
    constructor(logger: any, recoveryService: any) {
        this.logger = logger;
        this.recoveryService = recoveryService;
        this.logger.setContext(RecoveryController.name);
    }
    logger: any;
    recoveryService: any;
    @ApiOperation({ summary: 'upload recovery key' })
    @Post('recovery/upload.key')
    @ApiResponse({ type: BaseApiResponse })
    async uploadRecoveryKey(@Request() req: any, @Body() uploadRecoveryMasterKeyInput: any) {
            await this.recoveryService.uploadMaterKeyForRecovery(uploadRecoveryMasterKeyInput, req.user);
        }
    @ApiOperation({ summary: 'send recovery email' })
    @Post('recovery/guardian.send.email')
    @ApiResponse({ type: BaseApiResponse })
    async sendRecoveryEmail(@Request() ctx: any, @Body() sendRecoveryEmailInput: any) {
            await this.recoveryService.prepareStartRecovery(sendRecoveryEmailInput, ctx.user);
        }
    @ApiOperation({ summary: 'send start recovery by oauth id_token' })
    @Post('recovery/auth.oauth')
    @ApiResponse({ type: BaseApiResponse })
    async authByOAuthIdToken(@Request() req: any, @Body() authStartRecoveryByOAuthInput: any) {
            await this.recoveryService.authByOAuthIdToken(authStartRecoveryByOAuthInput, req.user);
        }
    @ApiOperation({ summary: 'get send recovery email receive status' })
    @Post('recovery/guardian.email.status')
    @ApiResponse({ type: SwaggerBaseApiResponse(QueryRecoveryOutput) })
    async getReceiveRecoveryEmailStatus(@Request() req: any) {
            const status = await this.recoveryService.getReceiveRecoveryEmailStatus(req.user);
            return status;
        }
    @ApiOperation({ summary: 'cancel recovery' })
    @Post('recovery/start')
    @ApiResponse({ type: BaseApiResponse })
    async startRecovery(@Request() req: any, @Body() startRecoveryInput: any) {
            await this.recoveryService.startRecovery(startRecoveryInput, req.user);
        }
    @ApiOperation({ summary: 'cancel recovery' })
    @Post('recovery/cancel')
    @ApiResponse({ type: BaseApiResponse })
    async cancelRecovery(@Request() req: any, @Body() cancelRecoveryInput: any) {
            await this.recoveryService.cancelRecovery(cancelRecoveryInput, req);
        }
}
