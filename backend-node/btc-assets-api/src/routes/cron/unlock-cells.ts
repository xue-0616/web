import pino from 'pino';
import { FastifyPluginCallback } from 'fastify';
import { Server } from 'http';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import container from '../../container';
import Unlocker from '../../services/unlocker';

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
      // BA-M1 FIX: Add Redis-based distributed lock to prevent concurrent execution
      const redis = container.resolve('redis') as any;
      const lockKey = 'rgbpp:cron:unlock-cells:lock';
      const lockAcquired = await redis.set(lockKey, Date.now().toString(), 'EX', 300, 'NX');
      if (!lockAcquired) {
        logger.info('[unlock-cells] Another instance is already running, skipping');
        return { skipped: true };
      }
      try {
        await unlocker.unlockCells();
      } catch (err) {
        logger.error(err);
        fastify.Sentry.captureException(err);
      } finally {
        await redis.del(lockKey);
      }
    },
  );
  done();
}
export default unlockCellsCronRoute;
