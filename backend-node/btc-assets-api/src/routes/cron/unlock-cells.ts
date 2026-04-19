import pino from 'pino';
import { FastifyPluginCallback } from 'fastify';
import { Server } from 'http';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import container from '../../container';
import Unlocker from '../../services/unlocker';
import { withRedisLock, type RedisLockClient } from '../../utils/redis-lock';

const unlockCellsCronRoute: FastifyPluginCallback<Record<never, never>, Server, ZodTypeProvider> = (
  fastify,
  _,
  done,
) => {
  fastify.get(
    '/unlock-cells',
    {
      schema: {
        tags: ['Cron Task'],
        description: 'Run BTC_TIME_LOCK cells unlock cron task, used for serverless deployment',
      },
    },
    async () => {
      const logger = container.resolve<pino.BaseLogger>('logger');
      const unlocker: Unlocker = container.resolve('unlocker');
      // BUG-B4/B5 consolidation: shared withRedisLock helper.
      const redis = container.resolve('redis') as RedisLockClient;
      const result = await withRedisLock(
        redis,
        {
          key: 'rgbpp:cron:unlock-cells:lock',
          ttlSec: 300,
          onSkip: () =>
            logger.info('[unlock-cells] Another instance is already running, skipping'),
        },
        async () => {
          try {
            await unlocker.unlockCells();
          } catch (err) {
            logger.error(err);
            fastify.Sentry.captureException(err);
          }
        },
      );
      if (!result.acquired) {
        return { skipped: true };
      }
    },
  );
  done();
}
export default unlockCellsCronRoute;
