import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitTgSolAddress1726629909579 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`
          CREATE TABLE tg_sol_address (
            id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'tg_sol_address table primary key',
            user_id bigint unsigned NULL COMMENT 'tg bind user id', 
            address VARCHAR(44) NOT NULL COMMENT 'user solana address',  
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY  uk_address (address,user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`DROP TABLE tg_sol_address`);
        }
}
