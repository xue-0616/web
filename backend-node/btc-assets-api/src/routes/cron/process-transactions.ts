import pino from 'pino';
import { FastifyPluginCallback } from 'fastify';
import { Server } from 'http';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import container from '../../container';
import TransactionProcessor from '../../services/transaction';
import { VERCEL_MAX_DURATION } from '../../constants';
import { withRedisLock, type RedisLockClient } from '../../utils/redis-lock';

const processTransactionsCronRoute: FastifyPluginCallback<Record<never, never>, Server, ZodTypeProvider> = (
  fastify,
  _,
  done,
) => {
  fastify.get(
    '/process-transactions',
    {
      schema: {
        tags: ['Cron Task'],
        description: 'Run RGB++ CKB transaction cron task, used for serverless deployment',
      },
    },
    async () => {
      const logger = container.resolve<pino.BaseLogger>('logger');
      const transactionProcessor: TransactionProcessor = container.resolve('transactionProcessor');
      // BUG-B5: consolidated onto the shared withRedisLock helper so
      // the release happens in a proper finally (bespoke SETNX leaked
      // the key whenever the body threw before the try/finally ran).
      const redis = container.resolve('redis') as RedisLockClient;
      const result = await withRedisLock(
        redis,
        {
          key: 'rgbpp:cron:process-transactions:lock',
          ttlSec: VERCEL_MAX_DURATION,
          onSkip: () =>
            logger.info('[process-transactions] Another instance is already running, skipping'),
        },
        async () => {
          try {
            await new Promise((resolve) => {
              setTimeout(resolve, (VERCEL_MAX_DURATION - 10) * 1000);
              transactionProcessor.startProcess({
                onActive: (job) => logger.info(`Job active: ${job.id}`),
                onCompleted: (job) => logger.info(`Job completed: ${job.id}`),
              });
            });
            await transactionProcessor.pauseProcess();
            await transactionProcessor.closeProcess();
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
export default processTransactionsCronRoute;
