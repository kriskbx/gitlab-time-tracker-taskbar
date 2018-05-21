FROM node:9.3

RUN apt-get update \
    && apt-get install -y \
        wine \
        xvfb \
        build-essential \
        devscripts \
        fakeroot \
        debhelper \
        automake \
        autotools-dev \
        pkg-config \
        git \
        ca-certificates \
        rpm \
        zip \
        --no-install-recommends \
    && yarn global add electron-forge
