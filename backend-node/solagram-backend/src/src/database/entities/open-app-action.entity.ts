import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

export enum OpenActionType {
    ShowHome = 0,
    Connect = 1,
    SignTransaction = 2,
}

export enum AppType {
    BlinkMiniApp = 0,
    Wallet = 1,
}

export enum OpenSource {
    Bot = 0,
    BlinkMiniApp = 1,
}

@Entity({ name: 'open_app_actions' })
export class OpenAppActionEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    userId!: number;
    @Column()
    action!: OpenActionType;
    @Column()
    appType!: AppType;
    @Column()
    source!: OpenSource;
    @Column()
    blinkId!: number;
    @Column()
    replyId!: number;
}
