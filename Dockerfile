ARG VERSION=lts

FROM --platform=$BUILDPLATFORM node:$VERSION-bullseye as build

ENV PYTHONUNBUFFERED=1
ENV NODE_OPTIONS="--es-module-specifier-resolution=node"

COPY . /tmp/build

WORKDIR /tmp/build

RUN apt-get update -y ; \
    apt-get upgrade -y ; \
    apt-get install -y git python3 gcc wget ; \
    npm ci ; \
    npm run npm:install ; \
    npm run build ; \
    npm ci --omit=dev --ignore-scripts ; \
    npm prune --production ; \
    rm -rf node_modules/*/test/ node_modules/*/tests/ ; \
    npm install -g modclean ; \
    modclean -n default:safe --run ; \
    mkdir -p /app ; \
    cp -r bin/ dist/ node_modules/ LICENSE package.json package-lock.json README.md /app/

FROM --platform=$TARGETPLATFORM node:$VERSION-bullseye-slim

LABEL org.opencontainers.image.authors="Soketi <open-source@soketi.app>"
LABEL org.opencontainers.image.source="https://github.com/soketi/impl"
LABEL org.opencontainers.image.url="https://soketi.app"
LABEL org.opencontainers.image.documentation="https://docs.soketi.app"
LABEL org.opencontainers.image.vendor="Soketi"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

ENV NODE_OPTIONS="--es-module-specifier-resolution=node"

COPY --from=build /app /app

WORKDIR /app

EXPOSE 6001

ENTRYPOINT ["node", "/app/bin/server.js", "start"]
