import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export enum TransactionType {
    StartRecovery = "startRecovery",
    SyncAccount = "syncAccount",
}

export class ReceiveEmailInput {
    @ApiProperty({
        type: String,
        description: 'receive email body',
    })
    @IsString()
    @IsNotEmpty({ message: 'body-mime not empty' })
    "body-mime": any;
}

export class TransactionIntent {
}
