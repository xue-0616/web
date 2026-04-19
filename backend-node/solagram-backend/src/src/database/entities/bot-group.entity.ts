import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

export enum JoinInStatus {
    Leave = 0,
    Active = 1,
}

@Entity({ name: 'bot_groups' })
export class BotGroupsEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    chatId!: number;
    @Column()
    groupTitle!: string;
    @Column()
    botUsername!: string;
    @Column()
    botId!: number;
    @Column()
    status!: JoinInStatus;
}
