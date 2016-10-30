# Castmill 2.0

Open Digital Signage Platform

# Widgets

Widgets are the primitives that shows any content on a display. Widgets must be completely isolated from the rest of
the system and other primitives. If a widgets crashes should not affect the player in any significant way. If a
widget leaks memory, it will be cleaned when the widget is destroyed.

Widgets should be self-contained. They must cache all the assets they need, as well as their code. They must work
online as well as offline. Service workers will be used for this.

More than one widget can exist at the same time on the display. Widgets can be used to fill layouts. But this is outside
the scope of the widget. The widget does just need to show, and play itself as required by the layout orchestrator.

Widgets may have a server componet besides the client part. The server component may be needed to feed the widget
with dynamic informations, such as news, real state data, etc.

# Layers

Layers are the containers of the widgets. Layers can be placed around in the screen, moved or animated. They are very lightweight
and expose the widget interface to the rest of the system.

# Layouts

Layouts are containers for several layers or playlists. A playlist can contain layers and layouts, allowing mixing
content with different layouts for maximum flexibility.

# Layer server
A layer server is responsible of putting and removing the layers on a given container.




