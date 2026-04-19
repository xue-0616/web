import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Validate } from 'class-validator';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';

export class AssetsInputDto {
    @ApiPropertyOptional({
        type: String,
        description: 'collection type hash',
    })
    @IsOptional()
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
    @ApiPropertyOptional({
        type: Boolean,
        description: 'Indicates whether to return detailed utxo information',
    })
    @IsBoolean()
    @IsOptional()
    fullUTXO!: boolean;
}
