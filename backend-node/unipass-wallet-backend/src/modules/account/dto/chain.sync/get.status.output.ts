import { ApiProperty } from '@nestjs/swagger';

export enum SyncStatus {
    Synced = 0,
    ServerSynced = 1,
    NotReceivedDynedEmail = 2,
    NotSynced = 3,
}

export class GetSyncStatusOutput {
    @ApiProperty({
        enum: SyncStatus,
        enumName: 'SignType',
        description: 'account status status: [0=synced,1:server synced, 2:not received sync email, 3:not synced]',
    })
    syncStatus: any;
}
