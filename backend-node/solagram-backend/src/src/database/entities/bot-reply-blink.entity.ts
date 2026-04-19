import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'bot_reply_blink' })
export class BotReplyBlinkEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    userId!: number;
    @Column()
    botId!: number;
    @Column()
    chatId!: number;
    @Column()
    messageId!: number;
    @Column()
    blinkId!: number;
}
