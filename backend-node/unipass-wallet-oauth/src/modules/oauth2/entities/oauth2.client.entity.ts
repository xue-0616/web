// Recovered from dist/oauth2.client.entity.js.map (source: ../../../../src/modules/oauth2/entities/oauth2.client.entity.ts)
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum ProviderType {
    auth0_unipass = 'auth0_unipass',
}

@Entity({ name: 'oauth2_client' })
export class OAuth2ClientEntity {
    @PrimaryColumn()
    clientId!: string;

    @Column()
    clientSecret!: string;

    @Column()
    resourceIds!: string;

    @Column({ default: 'openid profile email' })
    scope!: string;

    @Column({ default: 'implicit,authorization_code' })
    authorizedGrantTypes!: string;

    @Column({ default: '' })
    webServerRedirectUri!: string;

    @Column({ type: 'int', default: 30 })
    accessTokenValidity!: number;

    @Column({ default: '' })
    emailTemplate!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
