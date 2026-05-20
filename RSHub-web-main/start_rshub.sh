#!/bin/bash
# cd ./RSHub_web || { echo "ERROR: could not change directory"; exit 1; }
export NODE_ENV=production
npm run start -- --host 0.0.0.0 --port 6000
