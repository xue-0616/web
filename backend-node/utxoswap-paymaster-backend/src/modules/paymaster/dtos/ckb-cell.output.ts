import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IndexerCell } from '@rgbpp-sdk/ckb';
import { CKBScript } from './ckb-cell.input.dto';

export class CKBOutPoint {
  @ApiProperty({
    type: String,
    description: 'The transaction hash of the cell created',
  })
  @IsNotEmpty()
  @IsString()
  txHash!: string;

  @ApiProperty({
    type: String,
    description: 'The index of the transaction outputs which the cell created at',
  })
  @IsNotEmpty()
  @IsString()
  index!: string;
}

export class CKBCellOutput {
  @ApiProperty({
    type: String,
    description: 'The cell ckb capacity',
  })
  @IsNotEmpty()
  @IsString()
  capacity!: string;

  @ApiProperty({
    type: CKBScript,
    description: 'The lock script of the cell',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CKBScript)
  lock!: CKBScript;

  @ApiPropertyOptional({
    type: CKBScript,
    description: 'The type script of the cell',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CKBScript)
  type?: CKBScript;
}

export class CKBIndexerCell {
  @ApiPropertyOptional({
    type: String,
    description: 'The block number cell created',
  })
  @IsOptional()
  @IsString()
  blockNumber?: string;

  @ApiProperty({
    type: CKBOutPoint,
    description: 'The ckb cell outpoint',
  })
  @ValidateNested()
  @Type(() => CKBOutPoint)
  outPoint!: CKBOutPoint;

  @ApiProperty({
    type: CKBCellOutput,
    description: 'The ckb cell info',
  })
  @ValidateNested()
  @Type(() => CKBCellOutput)
  output!: CKBCellOutput;

  @ApiProperty({
    type: String,
    description: "The ckb cell data, hex string started with '0x' prefix",
  })
  @IsString()
  outputData!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'The index of the transaction cell created in block',
  })
  @IsOptional()
  @IsString()
  txIndex?: string;
}

export class CkbCellOutputDto {
  @ApiProperty({
    type: CKBIndexerCell,
    description: "The cell information of the paymaster's ckb cell",
  })
  ckbInputCell!: CKBIndexerCell;

  @ApiProperty({
    type: CKBCellOutput,
    description:
      'The output cell paymaster required in the intent transaction outputs for return ckb back',
  })
  paymasterIntentUDTCellForSwap!: CKBCellOutput;

  @ApiProperty({
    type: String,
    description:
      "The udt amount used to buy paymaster's ckb cell, unit: shannon. Hex string start with '0x'",
  })
  udtAmount!: string;
}
