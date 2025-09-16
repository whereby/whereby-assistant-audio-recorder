FROM node:20-bookworm-slim

ENV NODE_ENV=production

ARG DEBUG
ENV DEBUG=${DEBUG}

ARG API_BASE_URL
ENV API_BASE_URL=${API_BASE_URL}

ARG SIGNAL_BASE_URL
ENV SIGNAL_BASE_URL=${SIGNAL_BASE_URL}

WORKDIR /opt

RUN apt-get update && apt-get install -y git ffmpeg libasound2 \
  libasound2-plugins alsa-utils alsa-oss

RUN groupadd wherebyassistantgroup \
  && useradd -ms /bin/bash wherebyassistant \
  && usermod -aG wherebyassistantgroup wherebyassistant

COPY ./package.json ./
COPY ./yarn.lock ./

RUN yarn install --production

COPY ./scripts/update-sdk-base-url.sh ./scripts/
RUN chmod +x ./scripts/update-sdk-base-url.sh
RUN ./scripts/update-sdk-base-url.sh

COPY ./dist/ ./dist

RUN chown -R wherebyassistant:wherebyassistantgroup .

VOLUME /dev/shm:/dev/shm

USER wherebyassistant

EXPOSE 3000

CMD ["yarn", "start"]
