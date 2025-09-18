#!/bin/bash
set -e

# This script updates the base URL of the SDK in the node_modules folder to use
# local URLs if set as environmental variables

file="$(pwd)/node_modules/@whereby.com/core/dist/index"

if [ -z "$API_BASE_URL" ]; then
    echo "API_BASE_URL is not set, using the default production endpoint"
else
    prodApiBaseUrl='const API_BASE_URL = \".*\";'
    localApiBaseUrl="const API_BASE_URL = \"$API_BASE_URL\";"
    sed -i.bak "s|${prodApiBaseUrl}|${localApiBaseUrl}|g" $file.mjs
    sed -i.bak "s|${prodApiBaseUrl}|${localApiBaseUrl}|g" $file.cjs
    echo "API_BASE_URL is set to $API_BASE_URL"
fi

if [ -z "$SIGNAL_BASE_URL" ]; then
    echo "SIGNAL_BASE_URL is not set, using the default production endpoint"
else
    prodSignalBaseUrl='const SIGNAL_BASE_URL = \".*\";'
    localSignalBaseUrl="const SIGNAL_BASE_URL = \"$SIGNAL_BASE_URL\";"
    sed -i.bak "s|${prodSignalBaseUrl}|${localSignalBaseUrl}|g" $file.mjs
    sed -i.bak "s|${prodSignalBaseUrl}|${localSignalBaseUrl}|g" $file.cjs
    echo "SIGNAL_BASE_URL is set to $SIGNAL_BASE_URL"
fi
