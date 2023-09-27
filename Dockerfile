ARG VERSION=lts

FROM --platform=$TARGETPLATFORM node:18-bullseye

ENV PYTHONUNBUFFERED=1
ENV NODE_OPTIONS="--es-module-specifier-resolution=node"

COPY . /app

WORKDIR /app

RUN apt-get update -y ; \
    apt-get upgrade -y ; \
    apt-get install -y git python3 gcc wget ; \
    npm ci ; \
    npm run build

EXPOSE 6001

ENTRYPOINT ["/app/bin/reverb.js"]
