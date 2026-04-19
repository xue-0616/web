import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTokens1712479340104 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1712479340104';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            console.log(`${this.name} start running`);
            await queryRunner.connection.query('UPDATE `tokens` SET `total_supply` = ? WHERE `id` = ?', [21_000_000 * 10 ** 8, 1]);
        }
    async down(): Promise<void> { }
}
