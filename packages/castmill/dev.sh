#!/usr/bin/env bash

# Source environment variables from .env
if [ -f ../../.env ]; then
  export $(grep -v '^#' ../../.env | xargs)
fi

case $@ in
  c)
    iex -S mix
    ;;

  *)
    iex -S mix phx.server
    ;;
esac

