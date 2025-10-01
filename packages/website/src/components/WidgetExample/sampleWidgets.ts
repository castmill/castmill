// Sample widget data for documentation examples

// =============================================================================
// BASIC EXAMPLES - Single components demonstrating core concepts
// =============================================================================

export const simpleTextWidget = {
  name: 'Simple Text',
  description: 'A basic text component with static content',
  template: {
    type: 'text',
    name: 'greeting',
    opts: {
      text: 'Hello World!',
    },
    style: {
      fontSize: '2em',
      color: '#333',
      textAlign: 'center',
      padding: '1em',
    },
  },
};

export const simpleImageWidget = {
  name: 'Simple Image',
  description: 'A basic image display widget',
  template: {
    type: 'image',
    name: 'hero-image',
    opts: {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
      size: 'cover',
    },
    style: {
      width: '100%',
      height: '100%',
      borderRadius: '0.5em',
    },
  },
};

export const styledTextWidget = {
  name: 'Styled Text',
  description: 'Text component with custom styling',
  template: {
    type: 'text',
    name: 'announcement',
    opts: {
      text: 'Welcome to Castmill',
    },
    style: {
      fontSize: '3em',
      fontWeight: 'bold',
      color: '#2563eb',
      textAlign: 'center',
      padding: '2em',
      backgroundColor: '#f0f9ff',
      borderRadius: '0.75em',
      boxShadow: '0 0.25em 0.4em rgba(0,0,0,0.1)',
    },
  },
};

export const autoScrollTextWidget = {
  name: 'Auto-Scroll Text',
  description: 'Text that scrolls horizontally when it doesn\'t fit',
  template: {
    type: 'text',
    name: 'scrolling-news',
    opts: {
      text: 'BREAKING NEWS: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      autofit: {
        maxSize: 4,
        minSize: 2,
        maxLines: 1,
      },
    },
    style: {
      color: '#f8fafc',
      'font-weight': 'bold',
      padding: '0.75em 1.5em',
      'background-color': '#1e40af',
      'white-space': 'nowrap',
      'border-radius': '0.5em',
      display: 'flex',
      'align-items': 'center',
    },
  },
};

// =============================================================================
// DATA BINDING EXAMPLES - Showing dynamic content
// =============================================================================

export const textWithDataWidget = {
  name: 'Text with Data Binding',
  description: 'Text component that pulls content from data',
  template: {
    type: 'text',
    name: 'dynamic-greeting',
    opts: {
      text: { key: 'data.message' },
    },
    style: {
      fontSize: '2em',
      color: '#059669',
      textAlign: 'center',
      padding: '1em',
    },
  },
};

export const textWithDataData = {
  message: 'Hello from dynamic data!',
};

export const imageWithDataWidget = {
  name: 'Image with Data Binding',
  description: 'Image component with URL from data',
  template: {
    type: 'image',
    name: 'dynamic-image',
    opts: {
      url: { key: 'data.imageUrl' },
      size: 'contain',
    },
    style: {
      width: '100%',
      height: '100%',
    },
  },
};

export const imageWithDataData = {
  imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600',
};

// =============================================================================
// LAYOUT EXAMPLES - Groups and positioning
// =============================================================================

export const simpleGroupWidget = {
  name: 'Simple Group',
  description: 'A group containing two images side-by-side',
  template: {
    type: 'group',
    name: 'image-pair',
    components: [
      {
        type: 'image',
        name: 'left-image',
        opts: {
          url: 'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=400',
          size: 'cover',
        },
        style: {
          flex: '1',
          height: '100%',
          borderRadius: '0.5em 0 0 0.5em',
        },
      },
      {
        type: 'image',
        name: 'right-image',
        opts: {
          url: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400',
          size: 'cover',
        },
        style: {
          flex: '1',
          height: '100%',
          borderRadius: '0 0.5em 0.5em 0',
        },
      },
    ],
    style: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      height: '100%',
      gap: '0.5em',
    },
  },
};

export const flexLayoutWidget = {
  name: 'Flex Layout',
  description: 'Horizontal layout with flex positioning',
  template: {
    type: 'group',
    name: 'horizontal-layout',
    components: [
      {
        type: 'text',
        name: 'left',
        opts: {
          text: 'Left',
        },
        style: {
          flex: '1',
          fontSize: '1.5em',
          color: '#dc2626',
          textAlign: 'left',
        },
      },
      {
        type: 'text',
        name: 'center',
        opts: {
          text: 'Center',
        },
        style: {
          flex: '1',
          fontSize: '1.5em',
          color: '#059669',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        name: 'right',
        opts: {
          text: 'Right',
        },
        style: {
          flex: '1',
          fontSize: '1.5em',
          color: '#2563eb',
          textAlign: 'right',
        },
      },
    ],
    style: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '1em',
      gap: '1em',
    },
  },
};

// =============================================================================
// ANIMATION EXAMPLES - Simple animations
// =============================================================================

export const fadeInWidget = {
  name: 'Fade In Animation',
  description: 'Text that fades in smoothly',
  template: {
    type: 'text',
    name: 'fade-text',
    opts: {
      text: 'I fade in!',
    },
    style: {
      fontSize: '2.5em',
      fontWeight: 'bold',
      color: '#7c3aed',
      textAlign: 'center',
    },
    animations: [
      {
        keyframes: [
          {
            from: {
              opacity: 0,
            },
          },
          {
            to: {
              opacity: 1,
              duration: 1.5,
              ease: 'power2.out',
            },
          },
        ],
      },
    ],
  },
};

export const slideInWidget = {
  name: 'Slide In Animation',
  description: 'Text that slides in from the left',
  template: {
    type: 'text',
    name: 'slide-text',
    opts: {
      text: 'I slide in!',
    },
    style: {
      fontSize: '2.5em',
      fontWeight: 'bold',
      color: '#db2777',
      textAlign: 'center',
    },
    animations: [
      {
        keyframes: [
          {
            from: {
              x: -100,
              opacity: 0,
            },
          },
          {
            to: {
              x: 0,
              opacity: 1,
              duration: 1,
              ease: 'back.out',
            },
          },
        ],
      },
    ],
  },
};

// =============================================================================
// LIST EXAMPLES - Progressive complexity
// =============================================================================

export const simpleListWidget = {
  name: 'Simple List',
  description: 'A basic list with automatic pagination',
  template: {
    type: 'list',
    name: 'fruit-list',
    opts: {
      items: { key: 'data.items' },
      pageDuration: 3,
    },
    component: {
      type: 'text',
      name: 'item',
      opts: {
        text: { key: '$.name' },
        autofit: false, // Disable auto-sizing for predictable list item heights
      },
      style: {
        'font-size': '2em',
        padding: '1em 1.25em',
        'border-bottom': '0.0625em solid #374151',
        color: '#f3f4f6',
        'background-color': '#1f2937',
        'line-height': '1.2',
      },
    },
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      overflow: 'hidden',
      'background-color': '#111827',
      'border-radius': '0.5em',
    },
  },
};

export const simpleListData = {
  items: [
    { name: '🍎 Apple' },
    { name: '🍌 Banana' },
    { name: '🍊 Orange' },
    { name: '🍇 Grapes' },
    { name: '🍓 Strawberry' },
    { name: '🥝 Kiwi' },
    { name: '🍑 Peach' },
    { name: '🍉 Watermelon' },
  ],
};

// =============================================================================
// ADVANCED EXAMPLES - Complex widgets combining multiple concepts
// =============================================================================
// These examples demonstrate how to build sophisticated widgets by combining
// groups, lists, data binding, animations, and styling together.

export const dessertMenuWidget = {
  name: 'Dessert Menu Board',
  description: 'Elegant dessert menu with list pagination and animations',
  template: {
    type: 'group',
    name: 'menu-container',
    components: [
      {
        type: 'text',
        name: 'header',
        opts: {
          text: '🍰 Desserts',
          autofit: { baseSize: 2.5 },
        },
        style: {
          textAlign: 'center',
          color: '#c76565',
          fontWeight: 'bold',
          padding: '20px 0',
          borderBottom: '3px solid #c76565',
        },
      },
      {
        type: 'list',
        name: 'dessert-list',
        opts: {
          items: { key: 'data.desserts' },
          itemsPerPage: 4,
          pageDuration: 8,
        },
        component: {
          type: 'group',
          name: 'menu-item',
          components: [
            {
              type: 'text',
              name: 'name',
              opts: {
                text: { key: '$.name' },
                autofit: { baseSize: 1.5 },
              },
              style: {
                fontWeight: 'bold',
                color: '#2c3e50',
                flex: '0 0 40%',
              },
            },
            {
              type: 'text',
              name: 'description',
              opts: {
                text: { key: '$.description' },
              },
              style: {
                color: '#7f8c8d',
                fontSize: '0.9em',
                fontStyle: 'italic',
                flex: '1',
                padding: '0 15px',
              },
            },
            {
              type: 'text',
              name: 'price',
              opts: {
                text: { key: '$.price' },
              },
              style: {
                fontSize: '1.3em',
                fontWeight: 'bold',
                color: '#c76565',
                flex: '0 0 15%',
                textAlign: 'right',
              },
            },
          ],
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #ecf0f1',
          },
          animations: [
            {
              keyframes: [
                {
                  from: {
                    x: -30,
                    opacity: 0,
                  },
                },
                {
                  to: {
                    x: 0,
                    opacity: 1,
                    duration: 0.6,
                    ease: 'power2.out',
                  },
                },
              ],
            },
          ],
        },
        style: {
          flex: '1',
          overflow: 'hidden',
        },
      },
    ],
    style: {
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Georgia', serif",
    },
  },
};

export const restaurantMenuWidget = {
  name: 'Restaurant Menu',
  description: 'Rotating menu with images and prices',
  template: {
    type: 'group',
    name: 'menu-container',
    components: [
      {
        type: 'text',
        name: 'header',
        opts: {
          text: "Today's Specials",
          autofit: { baseSize: 2 },
        },
        style: {
          textAlign: 'center',
          color: '#2c3e50',
          padding: '20px 0',
          fontWeight: 'bold',
          borderBottom: '3px solid #e74c3c',
        },
      },
      {
        type: 'list',
        name: 'menu-list',
        opts: {
          items: { key: 'data.dishes' },
          itemsPerPage: 2,
          pageDuration: 6,
        },
        component: {
          type: 'group',
          name: 'dish',
          components: [
            {
              type: 'image',
              name: 'dish-image',
              opts: {
                url: { key: '$.image' },
                size: 'cover',
                duration: 6,
              },
              style: {
                width: '150px',
                height: '150px',
                borderRadius: '8px',
                objectFit: 'cover',
              },
            },
            {
              type: 'group',
              name: 'dish-info',
              components: [
                {
                  type: 'text',
                  name: 'dish-name',
                  opts: {
                    text: { key: '$.name' },
                    autofit: { baseSize: 1.5 },
                  },
                  style: {
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    marginBottom: '8px',
                  },
                },
                {
                  type: 'text',
                  name: 'description',
                  opts: {
                    text: { key: '$.description' },
                  },
                  style: {
                    color: '#7f8c8d',
                    fontSize: '0.9em',
                    lineHeight: '1.4',
                  },
                },
                {
                  type: 'text',
                  name: 'price',
                  opts: {
                    text: { key: '$.price' },
                  },
                  style: {
                    fontSize: '1.3em',
                    fontWeight: 'bold',
                    color: '#27ae60',
                    marginTop: '10px',
                  },
                },
              ],
              style: {
                flex: '1',
                padding: '0 20px',
              },
            },
          ],
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #ecf0f1',
          },
          animations: [
            {
              keyframes: [
                {
                  from: {
                    x: 50,
                    opacity: 0,
                  },
                },
                {
                  to: {
                    x: 0,
                    opacity: 1,
                    duration: 0.5,
                    ease: 'power2.out',
                  },
                },
              ],
            },
          ],
        },
        style: {
          flex: '1',
          overflow: 'hidden',
        },
      },
    ],
    style: {
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Georgia', serif",
    },
  },
};

export const restaurantMenuData = {
  dishes: [
    {
      name: 'Grilled Salmon',
      description:
        'Fresh Atlantic salmon with lemon butter sauce, seasonal vegetables',
      price: '$24.99',
      image:
        'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=400',
    },
    {
      name: 'Beef Wellington',
      description:
        'Tender beef fillet wrapped in puff pastry with mushroom duxelles',
      price: '$32.99',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    },
    {
      name: 'Margherita Pizza',
      description:
        'Fresh mozzarella, basil, and San Marzano tomatoes on wood-fired crust',
      price: '$16.99',
      image:
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
    },
    {
      name: 'Caesar Salad',
      description:
        'Crisp romaine, parmesan, croutons with classic Caesar dressing',
      price: '$12.99',
      image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
    },
  ],
};

export const dessertMenuData = {
  desserts: [
    {
      name: 'Ice Cream',
      price: '$15.45',
      description: 'Choose between Vanilla and Chocolate',
    },
    {
      name: 'Carrot Cake',
      price: '$5.95',
      description: 'The popular carrot cake with topped chocolate',
    },
    {
      name: 'Apple Pie',
      price: '$3.45',
      description: 'Delicious apple cake with vanilla sauce topping',
    },
    {
      name: 'Cupcake',
      price: '$2.95',
      description: 'Homemade treat baked to perfection',
    },
    {
      name: 'Donut',
      price: '$4.95',
      description: 'Choose between sugar glaze or chocolate',
    },
    {
      name: 'Muffin',
      price: '$5.95',
      description: 'Our famous home baked muffins',
    },
    {
      name: 'Tiramisu',
      price: '$10.95',
      description:
        'The Italian desire that you must try at least once in a lifetime',
    },
  ],
};
