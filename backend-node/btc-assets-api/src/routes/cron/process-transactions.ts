import pino from 'pino';
import { FastifyPluginCallback } from 'fastify';
import { Server } from 'http';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import container from '../../container';
import TransactionProcessor from '../../services/transaction';
import { VERCEL_MAX_DURATION } from '../../constants';

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
      // BA-M1 FIX: Add Redis-based distributed lock to prevent overlapping workers in serverless
      const redis = container.resolve('redis') as any;
      const lockKey = 'rgbpp:cron:process-transactions:lock';
      const lockAcquired = await redis.set(lockKey, Date.now().toString(), 'EX', VERCEL_MAX_DURATION, 'NX');
      if (!lockAcquired) {
        logger.info('[process-transactions] Another instance is already running, skipping');
        return { skipped: true };
      }
      try {
        await new Promise((resolve) => {
          setTimeout(resolve, (VERCEL_MAX_DURATION - 10) * 1000);
          transactionProcessor.startProcess({
            onActive: (job) => {
              logger.info(`Job active: ${job.id}`);
            },
            onCompleted: (job) => {
              logger.info(`Job completed: ${job.id}`);
            },
          });
        });
        await transactionProcessor.pauseProcess();
        await transactionProcessor.closeProcess();
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
export default processTransactionsCronRoute;
