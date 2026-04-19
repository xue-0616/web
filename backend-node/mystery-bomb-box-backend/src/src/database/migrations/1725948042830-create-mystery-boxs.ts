import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMysteryBox1725948042830 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`
          CREATE TABLE mystery_boxs (
            id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'mystery_boxs table primary key',
            transaction_id bigint unsigned NULL COMMENT 'solana_transaction 表绑定Id',
            lottery_draw_transaction_id bigint unsigned NULL COMMENT '开奖后绑定的交易 solana_transaction 表绑定Id',
            sender_address VARCHAR(44) NOT NULL COMMENT '发红包的用户地址',
            status tinyint NOT NULL COMMENT '红包状态:0:初始化 1:抢红包中 2:抢红包结束,3:初始化完成 4:红包初始化失败',
            amount bigint unsigned NOT NULL COMMENT '红包金额',
            bomb_number bigint NOT NULL COMMENT '炸弹数量',
            open_count bigint NOT NULL COMMENT '红包开启数量',
            open_limit bigint NOT NULL COMMENT '红包开启数量限制',
            lottery_draw_amount bigint NULL COMMENT '开奖的金额',
            grab_start_time bigint unsigned NULL COMMENT '开始抢红包时间',
            grab_end_time bigint unsigned NULL COMMENT '结束抢红包时间',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY \`uk_tx\` (transaction_id),
            KEY \`k_address\` (sender_address)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`DROP TABLE \`mystery_boxs\``);
        }
}
