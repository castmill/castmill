---
sidebar_position: 7
title: Contributing
description: Set up a development environment for Castmill, run the tests and submit changes.
---

# Contributing

Castmill is developed in the open at [github.com/castmill/castmill](https://github.com/castmill/castmill). Bug reports, documentation fixes and pull requests are welcome.

## Requirements

- Node.js 24 and Yarn 1
- Elixir 1.18 with Erlang/OTP 27
- PostgreSQL, for example `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`
- FFmpeg, for video transcoding

## Set up

```bash
git clone https://github.com/castmill/castmill.git
cd castmill
yarn install

# Build the shared packages that the server and dashboard use
yarn build:server

# Server: dependencies, database and assets
cd packages/castmill
mix setup
iex -S mix phx.server
```

The server listens on http://localhost:4000 and the admin tool is at http://localhost:4000/admin, with `root@example.com` and the password `root` in development. In a second terminal, start the dashboard:

```bash
yarn workspace castmill-dashboard dev
```

Then create a network with the domain `localhost:3000` in the admin tool, as in the [Quick start](../getting-started/quick-start.md#5-create-a-network). In development, sent emails are not delivered; read them at http://localhost:4000/dev/mailbox.

## Tests and checks

| What | Command |
| --- | --- |
| Server | `cd packages/castmill && mix test` |
| Dashboard | `yarn test:dashboard` (build `@castmill/ui-common` first) |
| Dashboard addons | `cd packages/castmill/assets && npx vitest run ../lib/castmill/addons/` |
| Player, cache, device | `yarn test:player`, `yarn test:cache`, `yarn test:device` |
| Players | `yarn test:platforms` |
| Formatting | `yarn format:check:all` and `cd packages/castmill && mix format --check-formatted` |
| Linting | `yarn lint:all` |
| Translations | `yarn check-translations` |
| Documentation | `yarn build:website` |

`packages/device` resolves `@castmill/cache` and `@castmill/player` from their build output, so run `yarn build:cache` and `yarn build:player` after you change them.

## Guidelines

- **TypeScript** for all new frontend code, with tests. New code should have at least 90% test coverage.
- **Translations**: every text in the dashboard exists in all nine languages: English, Spanish, Swedish, German, French, Chinese, Arabic, Korean and Japanese. `yarn check-translations` fails on missing keys.
- **Themes**: every view works in light and dark mode. Take colours from the `--cm-*` tokens in `packages/dashboard/src/theme/theme.scss`.
- **Routing**: dashboard addresses always include the organization, as in `/org/<id>/...`.
- **Players**: code that runs on players must work in Chrome 38. See [Player library](./player-library.md#compatibility).
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(player): keep video muted after seek`.
- **Formatting** runs automatically on commit through a Git hook: oxfmt for TypeScript and JavaScript, `mix format` for Elixir.

The `AGENTS.md` file in the repository root and the `agents/` folder contain detailed notes on each package and on cross-cutting systems. They are written for AI coding assistants and are useful for human contributors too.

## Documentation

This site lives in `packages/website`. Each chapter is a folder in `docs` with a `_category_.json`, and the sidebar is generated from the folders. Run it locally with:

```bash
yarn build:cache && yarn build:player
yarn dev:website
```

The [style guide](https://github.com/castmill/castmill/blob/main/packages/website/README.md) in the website package describes the writing style and the components available in pages.
