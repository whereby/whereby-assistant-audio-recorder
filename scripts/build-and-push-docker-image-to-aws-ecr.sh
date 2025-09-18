#!/bin/bash

# This script will build and push a new docker image to AWS ECR in preparation for the AWS SAM deploy flow
# NOTE: base image in ./iac/base MUST be built and deployed first (see README).

REGISTRY=$(aws cloudformation --region eu-west-1 describe-stacks --stack-name whereby-assistant-audio-recorder-base --query "Stacks[0].Outputs[?OutputKey=='RepositoryUrl'].OutputValue" --output text)

ACCOUNT=$(echo "$REGISTRY" | sed -e 's/\/.*$//')

aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin $ACCOUNT

yarn build:docker -t $REGISTRY:latest --build-arg SERVICE_PORT=80 --build-arg API_BASE_URL=https://api.appearin.net --build-arg SIGNAL_BASE_URL=wss://signal.appearin.net

docker push $REGISTRY:latest
