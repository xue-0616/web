import { MigrationInterface, QueryRunner } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';

export class UpdateTokenSeal1713769449198 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokenSeal1713769449198';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let token = await manager.findOne(TokenEntity, {
                    where: { symbol: 'Seal' },
                });
                if (!token) { await queryRunner.commitTransaction(); return; }
                token.lowercaseSymbol = 'seal';
                await manager.save(token);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
            }
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}
