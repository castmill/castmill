# Widgets

Widgets are the core components of Castmill and what ultimately shows any content on a display. Widgets are built on top of a set of SolidJS components that currently support the following types of content:

- Images
- Videos
- Text
- Smart Lists
- Groups
- Image Carousells
- Layouts

Widgets are defined as JSON objects that are then parsed by the player and rendered on the screen. The JSON format is very simple and allows for a lot of flexibility.

For example, the following JSON object defines a group of two text components:

```javascript
{
  type: "group",
  style: {
    width: "100%",
    height: "100%",
  },
  components: [
    {
      type: "text",
      opts: {
        autofit: {
          baseSize: 5,
        },
        text: "Short text",
      },
      style: {
        width: "20%",
        height: "10%",
        "text-align": "right",
        color: "white",
        "background-color": "black",
      },
    },
    {
      type: "text",
      opts: {
        autofit: {
          minSize: 4,
        },
        text: "This is just some long text",
      },
      style: {
        width: "30%",
        height: "10%",
        color: "white",
      },
    },
  ],
};
```

There are some important things to note here:

- Components are defined as objects with a `type` property that defines the type of component.
- Components can have a `style` property that defines the CSS style of the component.
- Components can have an `opts` property that defines the specific options of the component.
- Components can be nested, so you can have a group of groups of groups of groups...

There are many other fields that can be used in the widget, and we will discuss them in detail in the following sections.

## Components

As we have seen, a component is defined as an object with a `type` property. The `type` property defines the type of component that is going to be rendered. The following types of components are currently supported:

- `image`
- `video`
- `text`
- `group`
- `list`
- `image-carousel`
- `layout`

It may seem a small set of components, but since these components can be nested, you can create very complex widgets with them.

## Animations

All components support animations. Animations are built on top of GSAP and are defined as a sequence of keyframes, allowing for very
complex animations if needed.
