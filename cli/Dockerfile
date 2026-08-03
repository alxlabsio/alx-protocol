# ALX Protocol Verification Server
#
# Build from repository root:
#   docker build -f cli/Dockerfile -t alx-server .
# Run:
#   docker run -p 8080:8080 alx-server
#
# Endpoints:
#   GET  /health           — Health check
#   GET  /version          — CLI + protocol version
#   POST /block/create     — Create a Block
#   POST /block/validate   — Validate a Block
#   POST /trace            — Trace attribution

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sdk/ sdk/
COPY cli/ cli/
COPY protocol/ protocol/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @alx-protocol/sdk build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/sdk/ sdk/
COPY --from=build /app/cli/ cli/
COPY --from=build /app/protocol/ protocol/

EXPOSE 8080

CMD ["node", "cli/bin/alx.js", "server", "start", "--port", "8080"]
