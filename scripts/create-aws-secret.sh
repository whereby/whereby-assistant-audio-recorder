#!/bin/bash

# This script can be used to set required environment variables for the AWS SAM deployment to use

STACK_NAME=whereby-assistant-audio-recorder
STACK_REGION=eu-west-1

if [ $# -ne 2 ]; then
    echo "Usage: ./create-aws-secret.sh KEY_NAME KEY_VALUE"
    exit 1
fi

KEY_NAME="${STACK_NAME}_${1}"
KEY_VALUE="${2}"

aws secretsmanager create-secret \
    --region $STACK_REGION --no-cli-pager \
    --name $KEY_NAME --secret-string $KEY_VALUE
