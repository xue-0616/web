import { MigrationInterface, QueryRunner } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';

export class UpdateSealDeployTime1712958036751 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateSealDeployTime1712958036751';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let token = await manager.findOne(TokenEntity, { where: { id: 1 } });
                if (!token) { await queryRunner.commitTransaction(); return; }
                token.deployedTime = token.createdAt.getTime();
                await manager.save(token);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
            }
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}
