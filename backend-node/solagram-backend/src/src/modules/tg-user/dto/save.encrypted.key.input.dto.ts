import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export class SaveEncryptedKeyInputDto {
    @ApiProperty({
        name: 'key_encrypted',
        type: String,
    })
    @IsString()
    @Expose({ name: 'key_encrypted' })
    keyEncrypted: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    address: string;
}
