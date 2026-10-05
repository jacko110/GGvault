FROM node:24-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ledger/package.json packages/ledger/package.json
COPY packages/match-engine/package.json packages/match-engine/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --maxsockets=4 --fetch-retries=3 --fetch-timeout=120000
COPY . .
RUN npm run prisma:generate && npm run build

FROM build AS operations
ENTRYPOINT ["node", "deploy/start.cjs"]
CMD ["node", "scripts/ledger-invariants.cjs"]

FROM build AS runtime
RUN npm prune --omit=dev --ignore-scripts && mkdir -p /app/storage/evidence && chown -R node:node /app/apps/web/.next /app/apps/admin/.next /app/storage
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "deploy/start.cjs"]
CMD ["node", "apps/api/dist/main.js"]
