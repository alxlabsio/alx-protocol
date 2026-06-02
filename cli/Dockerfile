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
#   POST /test-vectors/run — Run conformance suite

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY reference-implementations/typescript/ reference-implementations/typescript/
COPY cli/ cli/
COPY protocol/ protocol/
RUN pnpm install --frozen-lockfile && pnpm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/reference-implementations/typescript/dist/ reference-implementations/typescript/dist/
COPY --from=build /app/reference-implementations/typescript/node_modules/ reference-implementations/typescript/node_modules/
COPY --from=build /app/protocol/test-vectors/ protocol/test-vectors/
COPY --from=build /app/cli/ cli/

EXPOSE 8080

CMD ["node", "cli/bin/alx.js", "serve", "--port", "8080"]
