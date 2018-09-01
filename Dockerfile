FROM ubuntu:16.04

RUN rm /bin/sh && ln -s /bin/bash /bin/sh && \
    sed -i 's/^mesg n$/tty -s \&\& mesg n/g' /root/.profile

WORKDIR /code

RUN apt update && apt install -y \
  g++-4.8 \
  icnsutils \
  graphicsmagick \
  libgnome-keyring-dev \
  xz-utils \
  xorriso \
  xvfb \
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
  libpng-dev \
  snapcraft

RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash && \
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  && \
    nvm install 8.4 && \
    npm install -g yarn

ENTRYPOINT ["/bin/bash", "--login", "-i", "-c"]
CMD ["bash"]
