# Castmill documentation

The documentation site at https://docs.castmill.io, built with [Docusaurus 3](https://docusaurus.io/).

## Development

The site embeds the real player for live widget examples, so build `@castmill/cache` and `@castmill/player` first:

```bash
yarn build:cache && yarn build:player   # from the repository root
cd packages/website
yarn start       # development server with live reload
yarn build       # production build into build/, fails on broken links
yarn serve       # serve the production build
yarn typecheck
```

`yarn build:website` in the repository root builds the dependencies and the site in one step. The site is deployed by `.github/workflows/deploy-docs.yml`.

## Structure

```
docs/
  intro.mdx                 Landing page of the docs
  getting-started/          Quick start, first sign-in, first screen
  concepts/                 Architecture, networks, organizations, roles, content model
  dashboard/                User guide, one page per dashboard area
  players/                  One page per player platform, offline playback, troubleshooting
  administration/           Self-hosting, configuration, admin tool, network administration, quotas
  developers/               APIs, MCP, addons, player library, contributing
    widgets/                Widget development
  reference/                Glossary and FAQ
src/
  pages/index.tsx           Home page
  components/               DocCards, Icon, HomeShowcase, WidgetPreview, WidgetExample, Screenshot
  theme/MDXComponents.tsx   Components available in every page without an import
  css/custom.css            Theme tokens for light and dark mode
plugins/
  llms-txt/                 Generates /llms.txt from the sidebar at build time
  social-cards/             Generates social card images at build time
```

The sidebar is generated from the folders. Each folder has a `_category_.json` with its label, position and landing page, and each page sets `sidebar_position` in its front matter.

### Adding a page

Create a Markdown file in the right chapter folder with this front matter:

```md
---
sidebar_position: 3
title: Page title
description: One sentence that describes the page. Used in search results, social cards and llms.txt.
---

# Page title
```

### Adding a chapter

Create a folder in `docs/` with a `_category_.json`:

```json
{
  "label": "Chapter name",
  "position": 9,
  "link": { "type": "generated-index", "description": "What the chapter covers." }
}
```

Use `"link": { "type": "doc", "id": "folder/page" }` instead to open an overview page when the chapter is clicked. Add the chapter to the navbar or footer in `docusaurus.config.js` if it is a main entry point.

## Components for pages

These components work in every `.md` and `.mdx` file without an import (`Screenshot` is described under [Screenshots](#screenshots)):

```mdx
<CardGrid columns={2}>
  <Card title="Channels" href="/docs/dashboard/channels" icon="calendar">
    Schedule playlists on a weekly calendar.
  </Card>
</CardGrid>

<Flow steps={["Media|Upload", "Playlist|Arrange", "Channel|Schedule", "Device|Play"]} />

<Steps>

### First step

Text of the first step.

### Second step

Text of the second step.

</Steps>
```

Icon names are listed in `src/components/Icon/index.tsx`. Live widget examples use `WidgetExample` with widgets from `src/components/WidgetExample/sampleWidgets.ts`; import both in an `.mdx` file. Mermaid is not enabled; use `Flow` or a table for diagrams.

### Screenshots

Dashboard screenshots exist in a light and a dark version, `static/img/screenshots/<id>-light.webp` and `<id>-dark.webp`. Show them with the `Screenshot` component, which picks the version that matches the site's colour mode:

```mdx
<Screenshot src="playlists-editor" alt="Playlist editor with five items and a live preview" />
```

Use `width={560}` for small captures such as dialogs. The screenshots are captured from a fictional demo with the scripts in `scripts/screenshots`; see its `README.md` to add or update one. Do not add screenshots taken from a real account.

## Style guide

- Write for the reader's task. Explain what something is for before how it works.
- Use the second person, the present tense and the active voice. Keep sentences and paragraphs short.
- Use sentence case for headings. The `title` and the `#` heading are the same.
- Write UI labels in bold, exactly as the dashboard shows them in English, and navigation as **Content → Playlists**.
- Use numbered lists for procedures, tables for reference information and admonitions (`:::tip`, `:::note`, `:::warning`) sparingly.
- Every fact must match the code. Link to the page that explains a concept instead of repeating it.
- No emoji, no exclamation marks and no filler or marketing words such as "seamless", "powerful", "robust", "simply" or "just".
- Use relative links to `.md` files (`../dashboard/channels.md`) so that the build checks them.
- Code examples use placeholders such as `$CASTMILL_URL` and `https://api.example.com`. Never include real secrets.

Both colour modes must work. Use the `--ifm-*` and `--cm-site-*` variables from `src/css/custom.css` in components instead of fixed colours.
