// Recovered from dist/oauth2.email.entity.js.map (source: ../../../../src/modules/oauth2/entities/oauth2.email.entity.ts)
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'oauth2_email' })
export class OAuth2EmailEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    clientId!: string;

    @Column()
    email!: string;

    @Column()
    sub!: string;

    @Column({ default: false })
    emailVerified!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
