import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiService } from './api.service';
import { IsIsValidTypedDataSignatureInput, IsValidMessageSignatureInput } from './dto/sign.input';
import { IsValidOutput } from './dto/sign.output';
import { getLogger } from '../common/logger/logger.helper';

@Controller('API')
@SkipThrottle()
export class APIController {
    constructor(private readonly apiService: ApiService) {
        this.logger = getLogger('api');
    }
    private logger: any;
    @Post('IsValidMessageSignature')
    async getIsValidMessageSignature(@Body() input: IsValidMessageSignatureInput): Promise<IsValidOutput> {
            this.logger.log(`[getIsValidMessageSignature] input ${JSON.stringify(input)}`);
            const data = await this.apiService.getIsValidMessageSignature(input);
            this.logger.log(`[getIsValidMessageSignature] output ${JSON.stringify(input)} output ${JSON.stringify(data)}`);
            return data;
        }
    @Post('IsValidTypedDataSignature')
    async getIsValidTypedDataSignature(@Body() input: IsIsValidTypedDataSignatureInput): Promise<IsValidOutput> {
            this.logger.log(`[IsValidTypedDataSignature] input ${JSON.stringify(input)}`);
            const data = await this.apiService.getIsValidTypedDataSignature(input);
            this.logger.log(`[IsValidTypedDataSignature] output ${JSON.stringify(input)} output ${JSON.stringify(data)}`);
            return data;
        }
}
