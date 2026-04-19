import fp from 'fastify-plugin';
import TransactionProcessor from '../services/transaction';
import cron from 'fastify-cron';
import { Env } from '../env';
import Unlocker from '../services/unlocker';
import { withRedisLock, type RedisLockClient } from '../utils/redis-lock';

export default fp(async (fastify) => {
  try {
    const env: Env = fastify.container.resolve('env');

    const getSentryCheckIn = (monitorSlug: string, crontab: string) => {
      const checkInId = fastify.Sentry.captureCheckIn(
        {
          monitorSlug,
          status: 'in_progress',
        },
        {
          schedule: {
            type: 'crontab',
            value: crontab,
          },
          // create a new issue when 3 times missed or error check-ins are processed
          failure_issue_threshold: 3,
          // close the issue when 3 times ok check-ins are processed
          recovery_threshold: 3,
        },
      );
      return {
        ok: () => {
          fastify.Sentry.captureCheckIn({
            checkInId,
            monitorSlug,
            status: 'ok',
          });
        },
        error: () => {
          fastify.Sentry.captureCheckIn({
            checkInId,
            monitorSlug,
            status: 'error',
          });
        },
      };
    };

    // processing rgb++ ckb transaction
    const transactionProcessor: TransactionProcessor = fastify.container.resolve('transactionProcessor');
    fastify.addHook('onReady', async () => {
      transactionProcessor.startProcess({
        onActive: (job) => {
          fastify.log.info(`Job active: ${job.id}`);
        },
        onCompleted: (job) => {
          fastify.log.info(`Job completed: ${job.id}`);
        },
      });
    });
    fastify.addHook('onClose', async () => {
      transactionProcessor.closeProcess();
    });

    // BUG-B4: shared redis client for distributed cron locks.
    const redis = fastify.container.resolve('redis') as RedisLockClient;

    const retryMissingTransactionsJob = {
      name: `retry-missing-transacitons-${env.NETWORK}`,
      cronTime: '*/5 * * * *',
      onTick: async () => {
        fastify.Sentry.startSpan({ op: 'cron', name: 'retry-missing-transactions' }, async () => {
          const { name, cronTime } = retryMissingTransactionsJob;
          const checkIn = getSentryCheckIn(name, cronTime);
          try {
            // BUG-B4: in multi-replica deployments we must only let
            // one instance run this at a time; TTL 290s keeps us
            // under the 5-minute cron period with a bit of margin.
            const r = await withRedisLock(
              redis,
              {
                key: `rgbpp:cron:retry-missing-tx:${env.NETWORK}`,
                ttlSec: 290,
                onSkip: () =>
                  fastify.log.info(
                    `[cron ${name}] lock held elsewhere, skipping this tick`,
                  ),
              },
              () => transactionProcessor.retryMissingTransactions(),
            );
            if (r.acquired) checkIn.ok();
          } catch (err) {
            checkIn.error();
            fastify.log.error(err);
            fastify.Sentry.captureException(err);
          }
        });
      },
    };

    // processing unlock BTC_TIME_LOCK cells
    const unlocker: Unlocker = fastify.container.resolve('unlocker');
    const monitorSlug = env.UNLOCKER_MONITOR_SLUG;
    const unlockBTCTimeLockCellsJob = {
      name: monitorSlug,
      cronTime: env.UNLOCKER_CRON_SCHEDULE,
      onTick: async () => {
        fastify.Sentry.startSpan({ op: 'cron', name: monitorSlug }, async () => {
          const { name, cronTime } = unlockBTCTimeLockCellsJob;
          const checkIn = getSentryCheckIn(name, cronTime);
          try {
            const r = await withRedisLock(
              redis,
              {
                key: `rgbpp:cron:unlock-cells:${env.NETWORK}`,
                ttlSec: 290,
                onSkip: () =>
                  fastify.log.info(
                    `[cron ${name}] lock held elsewhere, skipping this tick`,
                  ),
              },
              () => unlocker.unlockCells(),
            );
            if (r.acquired) checkIn.ok();
          } catch (err) {
            checkIn.error();
            fastify.log.error(err);
            fastify.Sentry.captureException(err);
          }
        });
      },
    };

    fastify.register(cron, {
      jobs: [retryMissingTransactionsJob, unlockBTCTimeLockCellsJob],
    });
  } catch (err) {
    fastify.log.error(err);
    fastify.Sentry.captureException(err);
  }
});
