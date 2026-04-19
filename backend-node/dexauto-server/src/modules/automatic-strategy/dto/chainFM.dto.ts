import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ChainFMChannelInfoRequestDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^https?:\/\/chain\.fm\/channel\/\d+$/, {
        message: 'url must be a valid chain.fm channel URL (e.g. https://chain.fm/channel/12345)',
    })
    url!: string;
}
