import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { BaseApiResponse, SwaggerBaseApiResponse } from '../../../interfaces';
import { CheckKeysetOutput, QueryAccountKeysetOutput, SignUpAccountOutput } from '../dto';
import { VerifyGuardianDataOutput } from '../../otp/dtos';
import { SnapKeyOutput } from '../dto/recovery/snap.signkey.output';

@Controller('account')
@ApiTags('account')
@UseGuards(UpJwtGuard)
export class AccountController {
    constructor(accountsService: any, guardianService: any, logger: any) {
        this.accountsService = accountsService;
        this.guardianService = guardianService;
        this.logger = logger;
        this.logger.setContext(AccountController.name);
    }
    accountsService: any;
    guardianService: any;
    logger: any;
    @ApiOperation({ summary: 'register a UniPass wallet account' })
    @Post('signup')
    @ApiResponse({ type: SwaggerBaseApiResponse(SignUpAccountOutput) })
    async signUp(@Request() req: any, @Body() signUpAccountInput: any) {
            const data = await this.accountsService.signUp(signUpAccountInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'send verify guardian link' })
    @Post('guardian.link')
    async senGuardianLink(@Request() req: any, @Body() sendGuardianLinkInput: any) {
            await this.guardianService.senGuardianLink(req.user, sendGuardianLinkInput);
        }
    @ApiOperation({ summary: 'get guardian verify status' })
    @Post('guardian.status')
    @ApiResponse({ type: SwaggerBaseApiResponse(VerifyGuardianDataOutput) })
    async getGuardianToken(@Request() req: any) {
            const data = await this.guardianService.getGuardianStatus(req.user);
            return data;
        }
    @ApiOperation({ summary: 'get account keyset raw data' })
    @Post('keyset')
    @ApiResponse({ type: SwaggerBaseApiResponse(QueryAccountKeysetOutput) })
    async getAccountKeyset(@Request() req: any) {
            const data = await this.accountsService.getAccountKeyset(req.user);
            return data;
        }
    @ApiOperation({ summary: 'check change keyset is only change guardian data' })
    @Post('keyset.check')
    @ApiResponse({ type: SwaggerBaseApiResponse(CheckKeysetOutput) })
    async chanKeyset(@Request() req: any, @Body() checkKeysetInput: any) {
            const data = await this.accountsService.checkKeyset(checkKeysetInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'update account guardian' })
    @Post('guardian.update')
    @ApiResponse({ type: BaseApiResponse })
    async updateGuardian(@Request() req: any, @Body() updateGuardianInput: any) {
            await this.accountsService.updateGuardian(updateGuardianInput, req.user);
        }
    @ApiOperation({ summary: 'update account chain sync status' })
    @Post('sync.update')
    @ApiResponse({ type: BaseApiResponse })
    async updateAccountChainSyncStatus(@Request() req: any) {
            await this.accountsService.updateAccountChainSyncStatus(req.user);
        }
    @ApiOperation({ summary: 'email provider check' })
    @ApiResponse({ type: SwaggerBaseApiResponse(SnapKeyOutput) })
    @Post('snap/sign.check')
    async snapSignCheck(@Body() masterKey: any, @Request() req: any) {
            const data = await this.accountsService.snapSignCheck(masterKey, req.user);
            return data;
        }
}
