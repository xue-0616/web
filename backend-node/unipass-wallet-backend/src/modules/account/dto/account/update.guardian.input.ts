import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CheckKeysetInput {
    @ApiProperty({
        description: 'keyset Json',
    })
    @IsString()
    @IsNotEmpty()
    keysetJson: any;
    @ApiProperty({
        description: 'is add guardian data true: add ,false:remove',
    })
    @IsBoolean()
    isAddGuradian: any;
}

export class UpdateGuardianInput {
    @ApiProperty({
        description: 'keyset Json',
    })
    @IsString()
    @IsNotEmpty()
    masterKeySig: any;
}
