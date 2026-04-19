import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('customer')
@ApiTags('customer')
export class CustomerController {
    constructor(customerService: any) {
        this.customerService = customerService;
    }
    customerService: any;
    @Post('test')
    @ApiOperation({
        summary: 'custom-auth login api',
    })
    async insertOrUpdate(@Body() input: any) {
            const data = await this.customerService.insertOrUpdate(input);
            return data;
        }
}
