# Castmill - Open Digital Signage Platform

Castmill is a complete platform for Digital Signage. It includes a player, a server and a web interface for managing the content.

Some of its features:

- HTML5 Lightweight and modular player. It can be used in any browser or integrated into any device.
- Flexible template-based widget system. Allows to create new widgets without coding.
- Support any media types, videos, images or audio.
- Widget layout system allows for any kind of imaginable setup.
- Optimized for maximum reliability, low memory and offline operation.

## Packages

The Castmill platform is composed of several packages:

- [Dashboard](./packages/dashboard/README.md) - The dashboard component of the platform.
- [Player](./packages/player/README.md) - Core library for the player.
- [Device](./packages/device/README.md) - Device management and configuration.
- [Cache](./packages/cache/README.md) - Cache and Resource Manager.
- [Server](./packages/server/README.md) - The server component of the platform.

## Development

### Code Formatting & Translation Validation

This project uses **automatic code formatting and translation validation** via Git hooks (Husky). When you commit code:

- **JavaScript/TypeScript** files are automatically formatted with Prettier
- **Elixir** files in `packages/castmill/` are automatically formatted with `mix format`
- **Translation files** (i18n) are automatically validated for 100% coverage across all 9 languages

**No manual formatting or translation checking needed!** Just `git commit` and:
1. Your code will be formatted automatically
2. Translation coverage will be validated
3. Commit will be blocked if translations are incomplete

You can still format and validate manually if needed:
```bash
yarn format:all                         # Format all frontend packages
cd packages/castmill && mix format      # Format Elixir code
yarn check-translations                 # Validate i18n coverage
```

See [.husky/README.md](./.husky/README.md) for more details.

## Learn more

- Official website: https://castmill.com/
- Guides: coming soon.
- Docs: coming soon.

## License

This software is open source and is covered by the [AGPLv3 license](./LICENSE.md). If you require a different license for commercial
purposes, please get in touch with us.
