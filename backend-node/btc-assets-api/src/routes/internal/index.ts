import { FastifyPluginCallback } from 'fastify';
import { Server } from 'http';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../../env';
import adminAuthorize from '../../hooks/admin-authorize';
import jobRoutes from './job';
import container from '../../container';

const internalRoutes: FastifyPluginCallback<Record<never, never>, Server, ZodTypeProvider> = (fastify, _, done) => {
  // If admin credentials not configured, block ALL internal routes
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    fastify.addHook('onRequest', async (_request, reply) => {
      reply.status(403).send({ error: 'Internal API not configured' });
    });
    return done();
  }

  fastify.addHook('onRequest', adminAuthorize);

  fastify.decorate('transactionProcessor', container.resolve('transactionProcessor'));

  fastify.register(jobRoutes, { prefix: '/job' });
  done();
}
export default internalRoutes;
