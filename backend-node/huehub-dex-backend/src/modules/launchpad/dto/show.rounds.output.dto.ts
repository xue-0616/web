import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Decimal from 'decimal.js';
import { RoundType } from '../../../database/entities/launchpad.rounds.entity';
import { ProjectStatus } from './launchpad.project.output.dto';

export class GetTokenRounds {
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'round id',
    })
    roundId: number;
    @ApiProperty({
        type: String,
        example: '15%',
        description: 'round supply rate',
    })
    roundRate: string;
    @ApiProperty({
        type: Number,
        example: 1717574576,
        description: 'round start time',
    })
    startTime: number;
    @ApiProperty({
        type: Number,
        example: 1729574576,
        description: 'round end time',
    })
    endTime: number;
    @ApiPropertyOptional({
        type: Number,
        example: 1729574576,
        description: 'round issue time',
    })
    issueTime: number;
    @ApiProperty({
        type: String,
        example: '100000000',
        description: 'total mint asset amount',
    })
    roundSupply: Decimal;
    @ApiProperty({
        type: String,
        example: '10',
        description: 'minted asset amount',
    })
    mintedAmount: Decimal;
    @ApiProperty({
        type: String,
        example: 'Whitelist',
        description: 'round name',
    })
    roundName: string;
    @ApiProperty({
        type: String,
        example: 1,
        description: 'round index',
    })
    roundIndex: number;
    @ApiProperty({
        type: Boolean,
        example: true,
        description: 'current round is live',
    })
    isActive: boolean;
    @ApiPropertyOptional({
        type: String,
        description: 'wallet link',
    })
    walletLink: string;
    @ApiProperty({
        enum: RoundType,
        example: RoundType.PublicMint,
        description: 'round type 0:whitelist,1:public mint 2:airdrop 3:excess draw 4:weighted allocation',
    })
    roundType: RoundType;
    @ApiProperty({
        enum: ProjectStatus,
        example: ProjectStatus.ComingSoon,
        description: 'launchpad status:0:ComingSoon,1:LiveNow,2:Finished',
    })
    status: ProjectStatus;
}

export class ShowRoundsOutput {
    @ApiPropertyOptional({
        type: [GetTokenRounds],
    })
    rounds: GetTokenRounds[];
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'token id',
    })
    id: number;
    @ApiProperty({
        type: String,
        example: 'TAX',
        description: 'token symbol',
    })
    symbol: string;
    @ApiProperty({
        type: String,
        example: '10000000000',
        description: 'token total supply',
    })
    totalSupply: Decimal;
    @ApiProperty({
        type: String,
        example: '10000000000',
        description: 'token total issued',
    })
    totalIssued: Decimal;
    @ApiProperty({
        type: Boolean,
        example: true,
        description: 'token can traded',
    })
    tradable: boolean;
    @ApiProperty({
        type: Number,
        example: 6,
        description: 'token decimal',
    })
    decimal: number;
    @ApiProperty({
        type: String,
    })
    xudtTypeHash: string;
    @ApiProperty({
        type: String,
    })
    xudtArgs: string;
}
