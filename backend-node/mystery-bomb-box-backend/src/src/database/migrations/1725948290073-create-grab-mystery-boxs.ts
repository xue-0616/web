import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGrabMysteryBox1725948290073 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`
          CREATE TABLE grab_mystery_boxs (
            id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'grab_mystery_boxs table primary key',
            box_id bigint unsigned NOT NULL COMMENT '抢红包id',
            transaction_id bigint unsigned NULL COMMENT 'solana_transaction 表绑定Id',
            sender_address VARCHAR(44) NOT NULL COMMENT '抢红包的用户地址',
            status tinyint NOT NULL COMMENT '交易状态 0:pending, 1:confirmed, 2:failed 3:lottery_draw_pending, 4:lottery_draw_confirmed, 5:lottery_draw_failed',
            lottery_draw_transaction_id bigint unsigned NULL COMMENT '开奖绑定的交易 表绑定Id',
            amount bigint unsigned NOT NULL COMMENT '抢到的红包金额',
            lottery_draw_amount bigint NULL COMMENT '开奖的金额',
            is_bomb tinyint NULL COMMENT '是否为雷 0:false. 1:true', 
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY \`uk_tx\` (transaction_id),
            KEY \`k_address\` (box_id, status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`DROP TABLE \`grab_mystery_boxs\``);
        }
}
