import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ActionInputDto {
    @ApiProperty()
    @IsString()
    // Solana addresses are base58 and always decode to 32 bytes, i.e. 32-44
    // base58 characters. Capping here prevents unbounded strings from
    // reaching `new PublicKey(...)` where the error path is more expensive.
    @Length(32, 44)
    account!: string;
}

export class ActionParamInputDto {
    @ApiProperty({
        type: Number,
    })
    @Transform(({ value }) => {
        const parsed = Number(value);
        return isNaN(parsed) ? value : parsed;
    })
    @IsNumber()
    // Clamp the SOL amount to a sane finite range. Without these bounds a
    // caller could send 0/negative/NaN/Infinity — all of which later become
    // `BigInt(amount * LAMPORTS_PER_SOL)` and either throw or produce a
    // garbage on-chain amount.
    @Min(0.000001)
    @Max(1000)
    amount!: number;
    @ApiProperty({
        type: Number,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @Max(10)
    @Min(0)
    @IsNumber()
    bombNumber!: number;
}
