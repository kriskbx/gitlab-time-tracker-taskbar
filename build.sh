#!/bin/bash

Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99.0
export DEBUG=electron-installer-snap:snapcraft
sleep 5

yarn install --force
yarn run production
yarn run publish
