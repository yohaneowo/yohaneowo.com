# Multi-stage build for the NAS: deps -> build -> slim runtime (.next/standalone).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
# Secrets come from Doppler at start when DOPPLER_TOKEN (a service token for the prd config) is
# set; without it the container uses its plain environment.
COPY --from=dopplerhq/cli:3 /bin/doppler /usr/local/bin/doppler
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "-c", "if [ -n \"$DOPPLER_TOKEN\" ]; then exec doppler run -- \"$@\"; else exec \"$@\"; fi", "--"]
CMD ["node", "server.js"]
