import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CKBCellOutput, CKBOutPoint } from './ckb-cell.output';

export class CKBCellInput {
  @ApiProperty({
    type: CKBOutPoint,
    description: 'cell outpoint',
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CKBOutPoint)
  previousOutput!: CKBOutPoint;

  @ApiProperty({
    type: String,
    description: 'cell input since',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  since!: string;
}

export class CKBCellDep {
  @ApiProperty({
    type: CKBOutPoint,
    description: "cell dep's outpoint",
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CKBOutPoint)
  outPoint!: CKBOutPoint;

  @ApiProperty({
    type: String,
    description: "cell dep's type",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(dep_group|code)$/, { message: 'depType must be dep_group or code' })
  depType!: string;
}

export class CKBWitnessArgs {
  @IsOptional()
  @IsString()
  lock?: string;

  @IsOptional()
  @IsString()
  inputType?: string;

  @IsOptional()
  @IsString()
  outputType?: string;
}

export class CKBRawTransactionToSign {
  @ApiProperty({
    type: [String],
    description: 'transaction witness args',
    required: true,
  })
  @IsArray()
  witnesses!: (string | CKBWitnessArgs)[];

  @ApiProperty({
    type: String,
    description: 'transaction version',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  version!: string;

  @ApiProperty({
    type: [CKBCellDep],
    description: 'transaction cell deps',
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CKBCellDep)
  cellDeps!: CKBCellDep[];

  @ApiProperty({
    type: [String],
    description: 'transaction header deps',
    required: true,
  })
  @IsArray()
  headerDeps!: string[];

  @ApiProperty({
    type: [CKBCellInput],
    description: 'transaction inputs',
    required: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Transaction must have at least one input' })
  @ValidateNested({ each: true })
  @Type(() => CKBCellInput)
  inputs!: CKBCellInput[];

  @ApiProperty({
    type: [CKBCellOutput],
    description: 'transaction outputs',
    required: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Transaction must have at least one output' })
  @ValidateNested({ each: true })
  @Type(() => CKBCellOutput)
  outputs!: CKBCellOutput[];

  @ApiProperty({
    type: [String],
    description: "transaction outputs' data",
    required: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Transaction must have at least one output data' })
  outputsData!: string[];
}

export class PaymasterSigInputDto {
  @ApiProperty({
    type: String,
    description: "user's ckb address",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  address!: string;

  @ApiProperty({
    type: CKBRawTransactionToSign,
    description: "user's intent transaction with user's signature in witness",
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CKBRawTransactionToSign)
  transaction!: CKBRawTransactionToSign;
}
