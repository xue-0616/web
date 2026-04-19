import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AlgType {
    sha256 = 'sha256',
    keccak256 = 'keccak256',
    personalHash = 'personalHash',
    keysetHash = 'keysetHash',
}

@Entity({ name: 'ori_hash' })
export class OriHashEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  raw!: string;

  @Column()
  hash!: string;

  @Column()
  alg!: AlgType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
