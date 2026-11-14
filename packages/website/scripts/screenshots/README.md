# Documentation screenshots

These scripts build a fictional demo ("Harbor Kitchen", a restaurant group, and a few other organizations in one network) and capture the dashboard screenshots used in the documentation. Every screenshot is captured twice, as `static/img/screenshots/<id>-light.webp` and `<id>-dark.webp`, and pages show them with the `<Screenshot>` component, which follows the site's colour mode.

All demo content is generated locally: `media.mjs` renders the images and video, and the people, organizations and email addresses are fictional (`@example.com`). Never point these scripts at a database with real data.

## Files

| File | Purpose |
| --- | --- |
| `bootstrap.exs` | Creates the demo network on `localhost:3000`, its organizations and users, and writes dashboard tokens to `.demo.json`. |
| `media.mjs` | Renders the demo slides and video into `.cache/media`. |
| `seed.mjs` | Creates the demo content through the dashboard API: media, playlists, layouts, channels, devices, teams, tags, feeds, automations and agents. |
| `players.mjs` | Runs browser players, so that demo devices register and show as online. |
| `shots.mjs` | The list of screenshots: page, setup steps and capture area. |
| `capture.mjs` | Captures the screenshots in light and dark mode. |

`.demo.json` and `.cache/` are git-ignored. The tokens in `.demo.json` are valid for one day; run the bootstrap again to renew them.

## Running

You need Docker, `ffmpeg`, the Elixir toolchain and the repository dependencies (`yarn install`).

Before starting Phoenix, build the shared packages and widget definitions from the repository root:

```bash
yarn build:server && yarn build:widged
```

1. Start an empty Postgres for the demo, on a port that no other database uses:

   ```bash
   docker run -d --name castmill-demo-pg -p 5436:5432 -e POSTGRES_PASSWORD=postgres postgres:16
   docker exec castmill-demo-pg psql -U postgres -c "create database castmill_bullmq_dev"
   ```

2. Create the schema and start the server against it:

   ```bash
   cd packages/castmill
   POSTGRES_PORT=5436 BULLMQ_DB_PORT=5436 mix ecto.setup
   POSTGRES_PORT=5436 BULLMQ_DB_PORT=5436 mix phx.server
   ```

3. In another terminal, start the dashboard with `yarn workspace castmill-dashboard dev`.

4. Create the demo network and its content:

   ```bash
   cd packages/castmill
   POSTGRES_PORT=5436 BULLMQ_DB_PORT=5436 mix run ../website/scripts/screenshots/bootstrap.exs
   cd ../website
   node scripts/screenshots/seed.mjs
   ```

5. Capture all screenshots, or only some of them by ID:

   ```bash
   node scripts/screenshots/capture.mjs
   node scripts/screenshots/capture.mjs playlists-editor devices-list
   ```

Review the images in both colour modes before committing them. When the dashboard changes, capture the affected shots again.

If a shot fails, the script retries it once and saves a screenshot of the failed page in the system's temporary folder (the log shows the path). Set `CAPTURE_DEBUG=1` to log how long each step of a capture takes.

## Adding a screenshot

1. Add an entry to `shots.mjs` with a unique `id`, the dashboard `path`, the steps that bring the page into the right state (`prepare`) and, for dialogs and panels, a `selector` to capture only that element.
2. Capture it: `node scripts/screenshots/capture.mjs <id>`.
3. Show it in the page:

   ```mdx
   <Screenshot src="<id>" alt="What the screenshot shows" />
   ```

   Use `width={560}` for small captures such as dialogs.
