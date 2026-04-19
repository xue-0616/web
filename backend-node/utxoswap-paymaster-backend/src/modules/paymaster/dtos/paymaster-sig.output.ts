import { ApiProperty } from '@nestjs/swagger';
import { CKBRawTransactionToSign } from './paymaster-sig.input.dto';

export class PaymasterSigOutputDto {
  @ApiProperty({
    type: CKBRawTransactionToSign,
    description: 'transaction signed by user and paymaster',
  })
  signedTransaction!: CKBRawTransactionToSign;

  @ApiProperty({
    type: String,
    description: "paymaster's signature",
  })
  sig!: string;
}
