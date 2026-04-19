import { ApiProperty } from '@nestjs/swagger';

export class GetUsdToAPOutput {
    @ApiProperty({
        type: String,
    })
    ap: any;
    @ApiProperty({
        type: Number,
    })
    decimal: any;
}

export class GetApTransactionSignatureOutput {
    @ApiProperty({
        type: String,
    })
    apSig: any;
}

export class DeductOutput {
    @ApiProperty({
        type: Boolean,
    })
    isDeduct: any;
}
