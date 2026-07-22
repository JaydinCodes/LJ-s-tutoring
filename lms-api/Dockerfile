FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY data ./data

RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/data ./data

EXPOSE 3001

# lms-api and the frontend static site are deployed as one DigitalOcean App;
# a failed migration here used to exit the container non-zero, which fails
# this component's health check and takes the WHOLE app's deployment down
# (including the unrelated, already-working frontend build) via DO's
# auto-rollback. lms-api is being retired domain-by-domain in favor of
# Supabase, so a migration failure against its own legacy Postgres must no
# longer be able to block deploys of anything else -- log and continue
# instead of exiting.
CMD ["sh", "-c", "node dist/db/migrate.js || echo 'lms-api: migration failed, starting server anyway'; node dist/index.js"]
