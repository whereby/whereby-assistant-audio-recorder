#!/bin/bash

# This script is used to build with local-stack addresses

if [[ $BIND_INTERFACE ]]; then
    interface=$BIND_INTERFACE
else
    # on mac, if we don't specify the interface we can get more than one IP
    interface=en0
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    localIp=$(ifconfig $interface | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p')
else
    localIp=$(hostname --ip-address)
fi

stackAddress="ip-${localIp//\./-}.hereby.dev"
apiUrl="https://${stackAddress}:4090"
signalUrl="wss://${stackAddress}:4070"

echo "Building docker image with API_BASE_URL=$apiUrl SIGNAL_BASE_URL=$signalUrl"
yarn build:docker -t audio_recorder:latest --build-arg API_BASE_URL=$apiUrl --build-arg SIGNAL_BASE_URL=$signalUrl