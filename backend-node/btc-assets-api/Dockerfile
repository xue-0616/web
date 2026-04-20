FROM node:20-slim

WORKDIR /app

COPY . .

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# NOTE: pnpm-lock.yaml in this repo is stale vs package.json (predates
# the @fastify/jwt v10 bump). Using --no-frozen-lockfile so the image
# can still build during rehearsal. Regenerate the lockfile and swap
# back to --frozen-lockfile before any production image tag.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile
RUN pnpm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV ADDRESS=0.0.0.0 PORT=3000

CMD ["pnpm", "start"]
