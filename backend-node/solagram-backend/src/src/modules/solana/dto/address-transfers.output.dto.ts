import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransfersData {
    @ApiProperty({ type: Number })
    instructionIndex: number;
    @ApiProperty({ type: Number })
    innerInstructionIndex: number;
    @ApiProperty()
    action: string;
    @ApiProperty()
    status: string;
    @ApiProperty()
    source: string;
    @ApiPropertyOptional()
    sourceAssociation: string;
    @ApiPropertyOptional()
    destination: string;
    @ApiPropertyOptional()
    destinationAssociation: string;
    @ApiProperty()
    token: string;
    @ApiProperty({ type: Number })
    amount: number;
    @ApiProperty({ type: Number })
    timestamp: number;
}

export class TransfersInfo {
    @ApiProperty()
    transactionHash: string;
    @ApiProperty({ type: [TransfersData] })
    data: TransfersData[];
}

export class Pagination {
    @ApiProperty({ type: Number })
    currentPage: number;
    @ApiProperty({ type: Number })
    totalPages: number;
}

export class AddressTransfersOutput {
    @ApiProperty()
    message: string;
    @ApiProperty()
    status: string;
    @ApiProperty({ type: [TransfersInfo] })
    results: TransfersInfo[];
    @ApiProperty({ type: Pagination })
    pagination: Pagination[];
}
