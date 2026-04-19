import { MyBaseEntity } from './base.entity';

export class TgUserEntity extends MyBaseEntity {
    userId!: number;
    accessHash?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    inviteCode?: string;
    inviterUserId?: number;
    invitedTime?: number;
    points?: number;
}
