import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1734346873416 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS trading_orders
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            wallet_address bytea NOT NULL,
            order_type smallint NOT NULL,
            trigger_price_usd numeric,
            pool bytea NOT NULL,
            slippage numeric NOT NULL,
            out_amount bigint,
            out_normalized_amount numeric,
            priority_fee bigint NOT NULL,
            bribery_amount bigint NOT NULL,
            is_anti_mev boolean NOT NULL,
            tx_id bytea,
            token_mint bytea NOT NULL,
            token_symbol character varying(32) NOT NULL COLLATE pg_catalog."default",
            token_amount bigint,
            token_normalized_amount numeric,
            token_usd_price numeric,
            sol_mint bytea NOT NULL,
            sol_amount bigint,
            sol_normalized_amount numeric,
            sol_usd_price numeric,
            usd_amount numeric,
            status smallint NOT NULL,
            error_reason character varying(1024) COLLATE pg_catalog."default",
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT trading_orders_pkey PRIMARY KEY (id),
            CONSTRAINT tx_uk UNIQUE (tx_id)
        )`);
        await queryRunner.query("COMMENT ON COLUMN trading_orders.id IS '@desc order id'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.user_id IS '@desc user id'");
        await queryRunner.query(`COMMENT ON COLUMN trading_orders.order_type IS '@desc order type
@values 0 swap buy | 1 swap sell  | 2 limit buy | 3 limit sell'`);
        await queryRunner.query("COMMENT ON COLUMN trading_orders.pool IS '@desc pool address'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.tx_id IS '@desc tx id'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.token_normalized_amount IS '@desc token decimal normalized amount'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.token_usd_price IS '@desc token usd price'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.sol_normalized_amount IS '@desc sol decimal normalized amount'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.sol_usd_price IS '@desc sol usd price'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.usd_amount IS '@desc order usd price'");
        await queryRunner.query(`COMMENT ON COLUMN trading_orders.status IS '@desc order status
@values 0 created | 1 tx pending | 2 success | 3 failed'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_orders.error_reason IS '@desc error reason'`);
        await queryRunner.query("COMMENT ON COLUMN trading_orders.created_at IS '@desc created time'");
        await queryRunner.query("COMMENT ON COLUMN trading_orders.updated_at IS '@desc updated time'");
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS pool_idx
ON trading_orders USING btree
(pool ASC NULLS LAST, status ASC NULLS LAST)
WITH (deduplicate_items=True)
TABLESPACE pg_default`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS order_user_status_idx
ON trading_orders USING btree
(user_id ASC NULLS LAST, status ASC NULLS LAST)
WITH (deduplicate_items=True)
TABLESPACE pg_default`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS order_user_type_idx
  ON trading_orders USING btree
  (user_id ASC NULLS LAST, order_type ASC NULLS LAST)
  WITH (deduplicate_items=True)
  TABLESPACE pg_default`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS order_updated_at_idx
    ON trading_orders USING btree
    (updated_at ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS trading_orders`);
    }
}
