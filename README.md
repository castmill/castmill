# Castmill - Open Digital Signage Player

Castmill is an Open Source library that implements a full featured Digital Signage player.
Some of its features:

- HTML5 Lightweight and modular player.
- Built-in widgets for playing videos, images or texts.
- Flexible layout system allows for any kind of imaginable setup.
- Optimized for maximul reliability, low memory and offline operation.

## Install

Use yarn or npm to install the package in your project:

```
yarn add @castmill/player
```

Check the demos and API reference for how to use the library.

# License

This library is covered by the AGPL license. If you are in need of a different license for commercial
purposes, please get in touch with us.

# Development

In order to build the library for development:

```bash
yarn dev
```

# Widgets

Widgets are the primitives that show any content on a display. Widgets must be completely isolated from the rest of
the system and other primitives. If a widget crashes should not affect the player in any significant way. If a
widget leaks memory, it will be cleaned when the widget is destroyed.

Widgets should be self-contained. They must cache all the assets they need, as well as their code. They must work
online as well as offline. Service workers will be used for this.

More than one widget can exist at the same time on the display. Widgets can be used to fill layouts. But this is outside
the scope of the widget. The widget does just need to show, and play itself as required by the layout orchestrator.

Widgets may have a server component besides the client part. The server component may be needed to feed the widget
with dynamic information, such as news, real state data, etc.

# Layers

Layers are the containers of the widgets. Layers can be placed around in the screen, moved or animated. They are very lightweight
and expose the widget interface to the rest of the system.

# Layouts

Layouts are containers for several layers or playlists. A playlist can contain layers and layouts, allowing mixing
content with different layouts for maximum flexibility.

# Layer server

A layer server is responsible of putting and removing the layers on a given container.

# Roadmap

- Looping of playlists including layouts.
- Triggers. Triggers to play a widget when some condition has been met.
- Caching using service workers.
- postMessage interface between widgets and layers.
- sandboxed iframes.
