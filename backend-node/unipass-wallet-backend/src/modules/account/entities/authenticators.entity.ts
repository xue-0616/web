import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AuthType {
    Email = 0,
    Phone = 1,
    GoogleAuthenticator = 2,
    WebAuthn = 3,
}

export enum AuthStatus {
    Close = 0,
    Open = 1,
    Remove = 2,
}

@Entity({ name: 'authenticators' })
export class AuthenticatorsEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    accountId: any;
    @Column()
    value: any;
    @Column()
    type: any;
    @Column()
    status: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
