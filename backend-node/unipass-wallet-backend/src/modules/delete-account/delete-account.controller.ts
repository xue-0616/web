import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../interfaces';
import { DeleteAccountOutput, IsDeleteAccountOutput } from './dto/delete.output';

@Controller('')
export class DeleteAccountController {
    constructor(deleteAccountService: any) {
        this.deleteAccountService = deleteAccountService;
    }
    deleteAccountService: any;
    @Post('deleteAccount')
    @ApiOperation({
        summary: 'delete account',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(DeleteAccountOutput) })
    async deleteAccount(@Body() input: any, @Request() req: any) {
            const data = await this.deleteAccountService.deleteAccount(input, req);
            return data;
        }
    @Post('isAccountDeleted')
    @ApiOperation({
        summary: 'query account delete status',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(IsDeleteAccountOutput) })
    async queryDeleteAccountStatus(@Body() input: any, @Request() req: any) {
            const data = await this.deleteAccountService.isAccountDeleted(input, req);
            return data;
        }
}
