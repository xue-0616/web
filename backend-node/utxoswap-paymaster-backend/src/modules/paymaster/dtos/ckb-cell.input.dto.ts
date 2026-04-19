import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CKBScript {
  @ApiProperty({
    type: String,
    required: true,
    description: 'hex string with 0x prefix',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]+$/, { message: 'args must be a hex string with 0x prefix' })
  args!: string;

  @ApiProperty({
    type: String,
    required: true,
    description: 'hash256',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'codeHash must be a 32-byte hex string with 0x prefix' })
  codeHash!: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "enum: 'data' | 'type' | 'data1' | 'data2'",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(data|type|data1|data2)$/, { message: 'hashType must be one of: data, type, data1, data2' })
  hashType!: string;
}

export class CkbCellInputDto {
  @ApiProperty({
    type: String,
    description: "user's ckb address",
  })
  @IsNotEmpty()
  @IsString()
  address!: string;

  @ApiProperty({
    type: CKBScript,
    description: "user's udt type script",
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CKBScript)
  assetType!: CKBScript;

  @ApiProperty({
    type: String,
    description:
      "user's intent cell lock args, only support addLiquidity / removeLiquidity / swap. Hex string with 0x prefix.",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]+$/, { message: 'intentArgs must be a hex string with 0x prefix' })
  intentArgs!: string;
}
