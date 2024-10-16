# Find eligible builder and runner images on Docker Hub. We use Ubuntu/Debian
# instead of Alpine to avoid DNS resolution issues in production.
#
# https://hub.docker.com/r/hexpm/elixir/tags?page=1&name=ubuntu
# https://hub.docker.com/_/ubuntu?tab=tags
#
# This file is based on these images:
#
#   - https://hub.docker.com/r/hexpm/elixir/tags - for the build image
#   - https://hub.docker.com/_/debian?tab=tags&page=1&name=bullseye-20230612-slim - for the release image
#   - https://pkgs.org/ - resource for finding needed packages
#   - Ex: hexpm/elixir:1.15.6-erlang-26.0.2-debian-bullseye-20230612-slim
#
ARG ELIXIR_VERSION=1.17.2
ARG OTP_VERSION=25.3.2.9
ARG DEBIAN_VERSION=bookworm-20240812-slim

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"

FROM ${BUILDER_IMAGE} AS builder

# install build dependencies
RUN apt-get update -y && apt-get install -y build-essential git curl\
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Install Nodejs@20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh && bash nodesource_setup.sh
RUN apt-get install -y nodejs

# Copy all
COPY . /app

# Install dependencies for all workspace packages
WORKDIR /app
RUN npm install --global yarn
RUN yarn install

# Run the build script for all workspaces
RUN yarn build:all

WORKDIR /app/packages/castmill

# Build assets
RUN cd assets && yarn install
RUN node assets/build.js

# install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Set build ENV
ENV MIX_ENV=prod

# Install mix dependencies
RUN mix deps.get --only $MIX_ENV

RUN mix phx.gen.release

RUN mix deps.compile

# compile assets
RUN mix assets.deploy
RUN mix phx.digest

# Compile the release
RUN mix compile

# Make the release
RUN mix release

# start a new build stage so that the final image will only contain
# the compiled release and other runtime necessities
FROM ${RUNNER_IMAGE}

RUN apt-get update -y && \
  apt-get install -y libstdc++6 openssl libncurses5 locales ca-certificates ffmpeg \
  \
  && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Set the locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

WORKDIR "/app"
RUN chown nobody /app

# set runner ENV
ENV MIX_ENV=prod

# Only copy the final release from the build stage
COPY --from=builder --chown=nobody:root /app/packages/castmill/_build/${MIX_ENV}/rel/castmill ./
COPY --from=builder --chown=nobody:root /app/packages/castmill/entrypoint.sh ./
COPY --from=builder --chown=nobody:root /app/packages/widged ./widged

# Copy compiled static assets
COPY --from=builder /app/packages/castmill/priv/static /app/priv/static

USER nobody

# If using an environment that doesn't automatically reap zombie processes, it is
# advised to add an init process such as tini via `apt-get install`
# above and adding an entrypoint. See https://github.com/krallin/tini for details
# ENTRYPOINT ["/tini", "--"]

ENTRYPOINT ["/app/entrypoint.sh"]
