FROM node:20-bookworm-slim

ENV NODE_ENV=production

ARG DEBUG
ENV DEBUG=${DEBUG}

ARG API_BASE_URL
ENV API_BASE_URL=${API_BASE_URL}

ARG SIGNAL_BASE_URL
ENV SIGNAL_BASE_URL=${SIGNAL_BASE_URL}

ARG SERVICE_PORT=3000
ENV SERVICE_PORT=${SERVICE_PORT}

WORKDIR /opt

# Install git and ffmpeg dependencies
RUN apt-get update && apt-get install -y git ffmpeg libasound2 \
    libasound2-plugins alsa-utils alsa-oss

COPY ./package.json ./
COPY ./yarn.lock ./

RUN yarn install --production

COPY ./scripts/update-sdk-base-url.sh ./scripts/
RUN chmod +x ./scripts/update-sdk-base-url.sh
RUN ./scripts/update-sdk-base-url.sh

COPY ./dist ./dist

VOLUME /dev/shm:/dev/shm

EXPOSE ${SERVICE_PORT}

ENTRYPOINT ["node", "/opt/dist/index.js"]