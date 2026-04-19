import { FastifyPluginCallback } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Server } from 'http';
import z from 'zod';
import { buildRgbppLockArgs, genRgbppLockScript } from '@rgbpp-sdk/ckb/lib/utils/rgbpp';
import { Cell } from './types';
import { CKBIndexerQueryOptions } from '@ckb-lumos/ckb-indexer/lib/type';

/**
 * BUG-B6 (LOW) cap: the CKB indexer collector streams cells without
 * an inherent bound; a hot RGB++ address could return tens of
 * thousands of cells, blowing Node's heap and blocking the event
 * loop. This constant bounds the array the route is willing to
 * accumulate in a single request. Legitimate callers stay well
 * under 100 cells per txid/vout; anyone hitting the cap is almost
 * certainly abusing the endpoint.
 */
const MAX_CELLS_PER_ASSET_QUERY = 1000;

const assetsRoute: FastifyPluginCallback<Record<never, never>, Server, ZodTypeProvider> = (fastify, _, done) => {
  fastify.get(
    '/:btc_txid',
    {
      schema: {
        description: `Get RGB++ assets by BTC txid. Capped at ${MAX_CELLS_PER_ASSET_QUERY} cells (BUG-B6).`,
        tags: ['RGB++'],
        params: z.object({
          btc_txid: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid Bitcoin txid format'),
        }),
        response: {
          200: z.array(Cell),
        },
      },
    },
    async (request) => {
      const { btc_txid } = request.params;
      const transaction = await fastify.bitcoin.getTx({ txid: btc_txid });
      const cells: Cell[] = [];
      outer: for (let index = 0; index < transaction.vout.length; index++) {
        const args = buildRgbppLockArgs(index, btc_txid);
        const query: CKBIndexerQueryOptions = {
          lock: genRgbppLockScript(args, process.env.NETWORK === 'mainnet'),
        };
        const collector = fastify.ckb.indexer.collector(query).collect();
        for await (const cell of collector) {
          cells.push(cell);
          if (cells.length >= MAX_CELLS_PER_ASSET_QUERY) {
            fastify.log.warn(
              `[assets] MAX_CELLS cap hit for btc_txid=${btc_txid}, truncating at ${MAX_CELLS_PER_ASSET_QUERY}`,
            );
            break outer;
          }
        }
      }
      return cells;
    },
  );

  fastify.get(
    '/:btc_txid/:vout',
    {
      schema: {
        description: `Get RGB++ assets by btc txid and vout. Capped at ${MAX_CELLS_PER_ASSET_QUERY} cells (BUG-B6).`,
        tags: ['RGB++'],
        params: z.object({
          btc_txid: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid Bitcoin txid format'),
          vout: z.coerce.number(),
        }),
        response: {
          200: z.array(Cell),
        },
      },
    },
    async (request) => {
      const { btc_txid, vout } = request.params;
      const args = buildRgbppLockArgs(vout, btc_txid);
      const lockScript = genRgbppLockScript(args, process.env.NETWORK === 'mainnet');

      const collector = fastify.ckb.indexer.collector({
        lock: lockScript,
      });

      const collect = collector.collect();
      const cells: Cell[] = [];
      for await (const cell of collect) {
        cells.push(cell);
        if (cells.length >= MAX_CELLS_PER_ASSET_QUERY) {
          fastify.log.warn(
            `[assets] MAX_CELLS cap hit for btc_txid=${btc_txid}/${vout}, truncating at ${MAX_CELLS_PER_ASSET_QUERY}`,
          );
          break;
        }
      }
      return cells;
    },
  );

  done();
}
export default assetsRoute;
