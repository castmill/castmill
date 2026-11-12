/* oxlint-disable unicorn/no-thenable -- template bindings use `cond.then` */
/**
 * Sample widgets rendered by the live previews in the "Widget development"
 * documentation (docs/developers/widgets).
 *
 * Every sample follows the conventions recommended in the docs:
 * - `fontScale: true` on the root component, so 1em is 10px on a 1920x1080
 *   screen and every size scales with the preview.
 * - Kebab-case CSS property names (camelCase names are ignored by the player).
 * - `em` units, flexbox without `gap`, and no CSS Grid, so the same templates
 *   run on legacy Chrome 38 players.
 */

const IMG = {
  plate: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
  skewers: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200',
  breakfast: 'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=800',
  dessert: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800',
  pancakes:
    'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800',
  salad: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  pizza: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  bowl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800',
};

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// =============================================================================
// INTRODUCTION - quick start
// =============================================================================

export const welcomeWidget = {
  name: 'Lobby welcome',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      'font-family': FONT,
      'background-image': 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    },
    components: [
      {
        type: 'group',
        name: 'content',
        style: {
          position: 'absolute',
          left: '10em',
          right: '10em',
          top: '0',
          bottom: '0',
          display: 'flex',
          'flex-direction': 'column',
          'justify-content': 'center',
        },
        components: [
          {
            type: 'text',
            name: 'eyebrow',
            opts: { text: { key: 'options.eyebrow', default: 'Welcome' } },
            style: {
              flex: '0 0 auto',
              'font-size': '3.6em',
              'letter-spacing': '0.2em',
              'text-transform': 'uppercase',
              color: '#7dd3fc',
            },
            animations: [
              { keyframes: [{ from: { opacity: 0, y: 20, duration: 0.8 } }] },
            ],
          },
          {
            type: 'text',
            name: 'title',
            opts: { text: { key: 'options.title' } },
            style: {
              flex: '0 0 auto',
              'margin-top': '0.3em',
              'font-size': '11em',
              'font-weight': '700',
              color: '#ffffff',
            },
            animations: [
              {
                keyframes: [
                  {
                    from: {
                      opacity: 0,
                      y: 30,
                      duration: 0.8,
                      delay: 0.2,
                      stagger: 0.1,
                    },
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            name: 'subtitle',
            opts: { text: { key: 'options.subtitle' } },
            style: {
              flex: '0 0 auto',
              'margin-top': '1.2em',
              'font-size': '4.4em',
              'line-height': '1.3em',
              color: 'rgba(255, 255, 255, 0.8)',
            },
            animations: [
              {
                keyframes: [{ from: { opacity: 0, duration: 1, delay: 0.8 } }],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const welcomeOptions = {
  eyebrow: 'Welcome',
  title: 'Northwind Studios',
  subtitle:
    'Reception is on the 3rd floor. Visitors, please sign in at the desk.',
};

// =============================================================================
// COMPONENTS
// =============================================================================

export const textAutofitWidget = {
  name: 'Autofit headline',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'font-family': FONT,
      background: '#111827',
    },
    components: [
      {
        type: 'text',
        name: 'headline',
        opts: {
          text: { key: 'options.headline' },
          autofit: { baseSize: 14, maxSize: 14, minSize: 4 },
        },
        style: {
          width: '80%',
          height: '50%',
          color: '#fbbf24',
          'font-weight': '700',
          'text-align': 'center',
        },
      },
    ],
  },
};

export const textAutofitOptions = {
  headline: 'Grand opening this Saturday',
};

export const textScrollWidget = {
  name: 'Scrolling text',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'center',
      'font-family': FONT,
      background: '#7f1d1d',
    },
    components: [
      {
        type: 'text',
        name: 'notice',
        opts: {
          text: { key: 'options.message' },
          autofit: { baseSize: 8, minSize: 8 },
        },
        style: {
          height: '14em',
          color: '#ffffff',
          'font-weight': '600',
          'white-space': 'nowrap',
        },
      },
    ],
  },
};

export const textScrollOptions = {
  message:
    'Service notice: the north entrance is closed for maintenance until Friday. Please use the main entrance on Harbour Street.',
};

export const imageWidget = {
  name: 'Image',
  template: {
    type: 'image',
    name: 'photo',
    fontScale: true,
    opts: {
      url: { key: 'options.image_url' },
      size: 'cover',
    },
    style: { width: '100%', height: '100%' },
  },
};

export const imageOptions = {
  image_url: IMG.plate,
};

const kpiTile = (
  name: string,
  label: string,
  value: string,
  color: string
) => ({
  type: 'group',
  name,
  style: {
    flex: '1 1 0',
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'center',
    'margin-left': '2em',
    'margin-right': '2em',
    padding: '4em',
    'border-radius': '1.6em',
    background: '#1f2937',
    'border-top': `0.8em solid ${color}`,
  },
  components: [
    {
      type: 'text',
      name: `${name}-value`,
      opts: { text: value },
      style: {
        flex: '0 0 auto',
        'font-size': '12em',
        'font-weight': '700',
        color: '#ffffff',
      },
    },
    {
      type: 'text',
      name: `${name}-label`,
      opts: { text: label },
      style: {
        flex: '0 0 auto',
        'margin-top': '1em',
        'font-size': '3.6em',
        color: '#9ca3af',
      },
    },
  ],
});

export const groupWidget = {
  name: 'KPI tiles',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'stretch',
      padding: '8em 6em',
      'box-sizing': 'border-box',
      'font-family': FONT,
      background: '#111827',
    },
    components: [
      kpiTile('visitors', 'Visitors today', '1 284', '#38bdf8'),
      kpiTile('orders', 'Orders', '342', '#a78bfa'),
      kpiTile('rating', 'Avg. rating', '4.8', '#34d399'),
    ],
  },
};

export const eventsListWidget = {
  name: 'Upcoming events',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      padding: '6em 8em',
      'box-sizing': 'border-box',
      'font-family': FONT,
      background: '#0f172a',
    },
    components: [
      {
        type: 'text',
        name: 'title',
        opts: { text: 'Upcoming events' },
        style: {
          flex: '0 0 auto',
          'font-size': '7em',
          'font-weight': '700',
          color: '#ffffff',
        },
      },
      {
        type: 'paginated-list',
        name: 'events',
        opts: {
          items: { key: 'data.events' },
          pageSize: 3,
          pageDuration: 4,
        },
        style: { flex: '1 1 auto', 'min-height': '0', 'margin-top': '4em' },
        component: {
          type: 'group',
          name: 'event',
          style: {
            display: 'flex',
            'align-items': 'center',
            height: '16em',
            'border-bottom': '0.2em solid #1e293b',
          },
          components: [
            {
              type: 'text',
              name: 'time',
              opts: { text: { fmt: "{$.start | date:'ddd HH:mm'}" } },
              style: {
                flex: '0 0 auto',
                width: '22%',
                'font-size': '4.8em',
                color: '#38bdf8',
              },
            },
            {
              type: 'text',
              name: 'name',
              opts: { text: { key: '$.title' } },
              style: {
                flex: '1 1 auto',
                'font-size': '5.2em',
                color: '#f8fafc',
              },
            },
            {
              type: 'text',
              name: 'room',
              opts: { text: { key: '$.room' } },
              style: {
                flex: '0 0 auto',
                width: '20%',
                'font-size': '4em',
                color: '#94a3b8',
                'text-align': 'right',
              },
            },
          ],
        },
      },
    ],
  },
};

export const eventsListData = {
  events: [
    {
      start: '2026-03-02T09:00:00',
      title: 'All-hands breakfast',
      room: 'Atrium',
    },
    { start: '2026-03-02T11:30:00', title: 'Product demo', room: 'Room 4.02' },
    {
      start: '2026-03-03T14:00:00',
      title: 'First-aid training',
      room: 'Room 2.10',
    },
    { start: '2026-03-04T16:00:00', title: 'Design review', room: 'Studio' },
    { start: '2026-03-05T12:00:00', title: 'Lunch and learn', room: 'Canteen' },
    {
      start: '2026-03-06T17:00:00',
      title: 'Friday social',
      room: 'Roof terrace',
    },
  ],
};

export const tickerWidget = {
  name: 'News ticker',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      'font-family': FONT,
      'background-image': 'linear-gradient(160deg, #1e3a8a, #0f172a)',
    },
    components: [
      {
        type: 'text',
        name: 'title',
        opts: { text: 'Harbour City today' },
        style: {
          position: 'absolute',
          left: '6%',
          top: '30%',
          'font-size': '11em',
          'font-weight': '700',
          color: '#ffffff',
        },
      },
      {
        type: 'group',
        name: 'bar',
        style: {
          position: 'absolute',
          left: '0',
          right: '0',
          bottom: '0',
          height: '14em',
          display: 'flex',
          background: '#111827',
        },
        components: [
          {
            type: 'text',
            name: 'label',
            opts: { text: 'LATEST' },
            style: {
              flex: '0 0 auto',
              width: 'auto',
              padding: '0 1em',
              'font-size': '5em',
              'line-height': '2.8em',
              'font-weight': '700',
              color: '#111827',
              background: '#facc15',
            },
          },
          {
            type: 'scroller',
            name: 'headlines',
            opts: {
              items: { key: 'data.headlines' },
              direction: 'left',
              speed: 120,
              gap: '0',
            },
            style: { flex: '1 1 auto', height: '100%' },
            component: {
              type: 'text',
              name: 'headline',
              opts: { text: { key: '$.title' } },
              style: {
                flex: '0 0 auto',
                width: 'auto',
                'margin-right': '1.6em',
                'font-size': '5em',
                'line-height': '2.8em',
                color: '#f9fafb',
                'white-space': 'nowrap',
              },
            },
          },
        ],
      },
    ],
  },
};

export const tickerData = {
  headlines: [
    { title: 'City council approves new cycle lanes along the waterfront' },
    { title: 'Local bakery wins national bread award' },
    { title: 'Weekend forecast: sunny spells, highs of 21 degrees' },
    { title: 'Museum extends opening hours for summer exhibition' },
  ],
};

export const carouselWidget = {
  name: 'Image carousel',
  template: {
    type: 'image-carousel',
    name: 'gallery',
    fontScale: true,
    opts: {
      images: { key: 'data.images' },
      imageDuration: 3,
      transition: 'fade',
    },
    style: { width: '100%', height: '100%' },
  },
};

export const carouselData = {
  images: [IMG.salad, IMG.pizza, IMG.pancakes, IMG.bowl],
};

export const qrCodeWidget = {
  name: 'QR code',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'font-family': FONT,
      background: '#ecfdf5',
    },
    components: [
      {
        type: 'group',
        name: 'copy',
        style: {
          flex: '0 1 auto',
          width: '50%',
          display: 'flex',
          'flex-direction': 'column',
          'margin-right': '8em',
        },
        components: [
          {
            type: 'text',
            name: 'title',
            opts: { text: 'Order from your table' },
            style: {
              flex: '0 0 auto',
              'font-size': '8em',
              'line-height': '1.1em',
              'font-weight': '700',
              color: '#064e3b',
            },
          },
          {
            type: 'text',
            name: 'hint',
            opts: { text: 'Scan the code with your phone camera.' },
            style: {
              flex: '0 0 auto',
              'margin-top': '1em',
              'font-size': '4.4em',
              color: '#047857',
            },
          },
        ],
      },
      {
        type: 'qr-code',
        name: 'qr',
        opts: {
          content: { key: 'options.url' },
          foregroundColor: '#064e3b',
          backgroundColor: '#ffffff',
        },
        style: {
          flex: '0 0 auto',
          width: '50em',
          height: '50em',
          padding: '2.4em',
          background: '#ffffff',
          'border-radius': '2em',
        },
      },
    ],
  },
};

export const qrCodeOptions = {
  url: 'https://castmill.io',
};

// =============================================================================
// DATA BINDING
// =============================================================================

export const salesKpiWidget = {
  name: 'Sales KPI',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      'justify-content': 'center',
      padding: '0 12em',
      'box-sizing': 'border-box',
      'font-family': FONT,
      background: '#0b1220',
    },
    components: [
      {
        type: 'text',
        name: 'label',
        opts: { text: { fmt: '{data.region | upper} - revenue this month' } },
        style: {
          flex: '0 0 auto',
          'font-size': '4.4em',
          'letter-spacing': '0.1em',
          color: '#94a3b8',
        },
      },
      {
        type: 'text',
        name: 'value',
        opts: { text: { fmt: '{data.revenue | number:0} {options.currency}' } },
        style: {
          flex: '0 0 auto',
          'margin-top': '0.2em',
          'font-size': '18em',
          'font-weight': '700',
          color: {
            cond: {
              key: 'data.change',
              gte: 0,
              then: '#4ade80',
              else: '#f87171',
            },
          },
        },
      },
      {
        type: 'text',
        name: 'status',
        opts: {
          text: {
            switch: {
              key: 'data.status',
              cases: {
                ahead: { fmt: 'Ahead of target by {data.change | number:1}%' },
                behind: { fmt: 'Behind target by {data.change | number:1}%' },
                default: 'On target',
              },
            },
          },
        },
        style: {
          flex: '0 0 auto',
          'margin-top': '1em',
          'font-size': '5em',
          color: '#e2e8f0',
        },
      },
      {
        type: 'text',
        name: 'updated',
        opts: {
          text: { fmt: "Updated {data.updated_at | date:'D MMM YYYY, HH:mm'}" },
        },
        style: {
          flex: '0 0 auto',
          'margin-top': '3em',
          'font-size': '3em',
          color: '#64748b',
        },
      },
    ],
  },
};

export const salesKpiData = {
  region: 'Nordics',
  revenue: 1284500.75,
  change: 6.4,
  status: 'ahead',
  updated_at: '2026-03-02T08:30:00',
};

export const salesKpiOptions = {
  currency: 'EUR',
};

export const clockWidget = {
  name: 'Clock',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'center',
      'justify-content': 'center',
      'font-family': FONT,
      'background-image': 'linear-gradient(160deg, #1e1b4b, #312e81)',
    },
    components: [
      {
        type: 'text',
        name: 'time',
        opts: { text: { fmt: "{@now | date:'HH:mm'}" } },
        style: {
          flex: '0 0 auto',
          'font-size': '24em',
          'font-weight': '200',
          color: '#ffffff',
          'text-align': 'center',
        },
      },
      {
        type: 'text',
        name: 'date',
        opts: { text: { fmt: "{@now | date:'dddd D MMMM'}" } },
        style: {
          flex: '0 0 auto',
          'margin-top': '1em',
          'font-size': '5.6em',
          color: '#c7d2fe',
          'text-align': 'center',
        },
      },
    ],
  },
};

// =============================================================================
// ANIMATIONS
// =============================================================================

const animationStage = (component: any, background: string) => ({
  type: 'group',
  name: 'root',
  fontScale: true,
  style: {
    width: '100%',
    height: '100%',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'font-family': FONT,
    background,
  },
  components: [component],
});

export const fadeInWidget = {
  name: 'Fade in',
  template: animationStage(
    {
      type: 'group',
      name: 'card',
      style: {
        display: 'flex',
        padding: '5em 8em',
        'border-radius': '2em',
        background: '#ffffff',
      },
      components: [
        {
          type: 'text',
          name: 'message',
          opts: { text: 'Fresh coffee, all day' },
          style: {
            flex: '0 0 auto',
            width: 'auto',
            'font-size': '8em',
            'font-weight': '700',
            color: '#78350f',
          },
        },
      ],
      animations: [
        {
          keyframes: [
            {
              from: {
                opacity: 0,
                scale: 0.9,
                duration: 1.2,
                ease: 'power2.out',
              },
            },
          ],
        },
      ],
    },
    '#fef3c7'
  ),
};

export const staggerWidget = {
  name: 'Word-by-word entrance',
  template: animationStage(
    {
      type: 'text',
      name: 'headline',
      opts: { text: 'Spring collection now in store' },
      style: {
        flex: '0 0 auto',
        width: '80%',
        'font-size': '10em',
        'line-height': '1.1em',
        'font-weight': '700',
        color: '#ffffff',
        'text-align': 'center',
      },
      animations: [
        {
          keyframes: [
            {
              from: {
                opacity: 0,
                yPercent: 50,
                duration: 0.6,
                stagger: 0.15,
                ease: 'back.out(1.7)',
              },
            },
          ],
        },
        {
          start: -1000,
          keyframes: [{ to: { opacity: 0, duration: 0.8 } }],
        },
      ],
    },
    '#be185d'
  ),
};

export const pulseWidget = {
  name: 'Pulsing badge',
  template: animationStage(
    {
      type: 'group',
      name: 'badge',
      style: {
        flex: '0 0 auto',
        padding: '3.6em 9em',
        'border-radius': '3.6em',
        background: '#16a34a',
      },
      components: [
        {
          type: 'text',
          name: 'badge-text',
          opts: { text: 'OPEN NOW' },
          style: {
            position: 'relative',
            'font-size': '9em',
            'font-weight': '700',
            color: '#ffffff',
            'white-space': 'nowrap',
          },
        },
      ],
      animations: [
        {
          init: { repeat: -1, yoyo: true },
          keyframes: [
            { to: { scale: 1.08, duration: 0.8, ease: 'sine.inOut' } },
          ],
        },
      ],
    },
    '#052e16'
  ),
};

// =============================================================================
// STYLING
// =============================================================================

export const splitLayoutWidget = {
  name: 'Split layout',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'font-family': FONT,
      background: '#fafaf9',
    },
    components: [
      {
        type: 'image',
        name: 'photo',
        opts: { url: { key: 'options.image_url' }, size: 'cover' },
        style: { flex: '0 0 50%', height: '100%' },
      },
      {
        type: 'group',
        name: 'copy',
        style: {
          flex: '1 1 auto',
          display: 'flex',
          'flex-direction': 'column',
          'justify-content': 'center',
          padding: '0 8em',
        },
        components: [
          {
            type: 'text',
            name: 'kicker',
            opts: { text: "Chef's special" },
            style: {
              flex: '0 0 auto',
              'font-size': '3.6em',
              'letter-spacing': '0.15em',
              'text-transform': 'uppercase',
              color: '#b45309',
            },
          },
          {
            type: 'text',
            name: 'title',
            opts: { text: { key: 'options.title' } },
            style: {
              flex: '0 0 auto',
              'margin-top': '0.4em',
              'font-size': '9em',
              'line-height': '1.05em',
              'font-weight': '700',
              color: '#1c1917',
            },
          },
          {
            type: 'text',
            name: 'price',
            opts: { text: { fmt: '{options.price | number:2} EUR' } },
            style: {
              flex: '0 0 auto',
              'margin-top': '1em',
              'font-size': '6em',
              color: '#b45309',
            },
          },
        ],
      },
    ],
  },
};

export const splitLayoutOptions = {
  image_url: IMG.skewers,
  title: 'Grilled chicken skewers',
  price: 14.5,
};

// =============================================================================
// EXAMPLES
// =============================================================================

export const cafeMenuWidget = {
  name: 'Cafe menu board',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'font-family': FONT,
      background: '#1c1917',
    },
    components: [
      {
        type: 'group',
        name: 'hero',
        style: { position: 'relative', flex: '0 0 36%', height: '100%' },
        components: [
          {
            type: 'image',
            name: 'hero-image',
            opts: { url: { key: 'options.hero_image' }, size: 'cover' },
            style: {
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
            },
          },
          {
            type: 'group',
            name: 'hero-caption',
            style: {
              position: 'absolute',
              left: '0',
              right: '0',
              bottom: '0',
              padding: '6em 5em',
              'background-image':
                'linear-gradient(to top, rgba(28, 25, 23, 0.95), rgba(28, 25, 23, 0))',
            },
            components: [
              {
                type: 'text',
                name: 'section',
                opts: { text: { key: 'options.section' } },
                style: {
                  position: 'relative',
                  'font-size': '9em',
                  'font-weight': '700',
                  color: '#fafaf9',
                },
              },
            ],
          },
        ],
      },
      {
        type: 'paginated-list',
        name: 'menu',
        opts: {
          items: {
            list: {
              key: 'data.items',
              where: [{ key: '$.available', eq: true }],
            },
          },
          pageSize: 5,
          pageDuration: 6,
        },
        style: {
          flex: '1 1 auto',
          height: '100%',
          padding: '5em 7em',
          'box-sizing': 'border-box',
        },
        component: {
          type: 'group',
          name: 'dish',
          style: {
            display: 'flex',
            'align-items': 'center',
            height: '17em',
            'border-bottom': '0.2em solid #44403c',
          },
          components: [
            {
              type: 'group',
              name: 'dish-text',
              style: {
                flex: '1 1 auto',
                display: 'flex',
                'flex-direction': 'column',
                'justify-content': 'center',
                'min-width': '0',
              },
              components: [
                {
                  type: 'group',
                  name: 'dish-title',
                  style: { display: 'flex', 'align-items': 'center' },
                  components: [
                    {
                      type: 'text',
                      name: 'dish-name',
                      opts: { text: { key: '$.name' } },
                      style: {
                        flex: '0 1 auto',
                        width: 'auto',
                        'font-size': '5.4em',
                        'font-weight': '700',
                        color: '#fafaf9',
                      },
                    },
                    {
                      type: 'text',
                      name: 'dish-tag',
                      when: { key: '$.tag' },
                      opts: { text: { fmt: '{$.tag | upper}' } },
                      style: {
                        flex: '0 0 auto',
                        width: 'auto',
                        'margin-left': '1em',
                        padding: '0.3em 0.6em',
                        'border-radius': '0.3em',
                        'font-size': '2.6em',
                        'font-weight': '700',
                        color: '#14532d',
                        background: '#bbf7d0',
                      },
                    },
                  ],
                },
                {
                  type: 'text',
                  name: 'dish-description',
                  opts: { text: { key: '$.description' } },
                  style: {
                    flex: '0 0 auto',
                    'margin-top': '0.5em',
                    'font-size': '3.4em',
                    'line-height': '1.3em',
                    color: '#a8a29e',
                  },
                },
              ],
            },
            {
              type: 'text',
              name: 'dish-price',
              opts: {
                text: { fmt: '{$.price | number:2} {options.currency}' },
              },
              style: {
                flex: '0 0 auto',
                width: 'auto',
                'margin-left': '3em',
                'font-size': '5.4em',
                'font-weight': '700',
                color: '#fbbf24',
                'white-space': 'nowrap',
              },
            },
          ],
        },
      },
    ],
  },
};

export const cafeMenuOptions = {
  section: 'Breakfast',
  hero_image: IMG.breakfast,
  currency: 'EUR',
};

export const cafeMenuData = {
  items: [
    {
      name: 'Buttermilk pancakes',
      description: 'Maple syrup, berries, whipped butter',
      price: 9.5,
      available: true,
    },
    {
      name: 'Avocado toast',
      description: 'Sourdough, chili flakes, lime',
      price: 8,
      tag: 'vegan',
      available: true,
    },
    {
      name: 'Eggs Benedict',
      description: 'Poached eggs, ham, hollandaise',
      price: 11.5,
      available: false,
    },
    {
      name: 'Granola bowl',
      description: 'Greek yoghurt, honey, seasonal fruit',
      price: 7.5,
      tag: 'new',
      available: true,
    },
    {
      name: 'Shakshuka',
      description: 'Baked eggs, spiced tomato, feta',
      price: 10,
      available: true,
    },
    {
      name: 'Breakfast burrito',
      description: 'Scrambled eggs, beans, salsa verde',
      price: 9,
      available: true,
    },
    {
      name: 'Fresh orange juice',
      description: 'Pressed to order, 30 cl',
      price: 4.5,
      tag: 'vegan',
      available: true,
    },
  ],
};

export const meetingRoomWidget = {
  name: 'Meeting room sign',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      padding: '7em 9em',
      'box-sizing': 'border-box',
      'font-family': FONT,
      color: '#ffffff',
      background: '#15803d',
    },
    $styles: [
      { filter: { 'data.status': 'busy' }, style: { background: '#b91c1c' } },
    ],
    components: [
      {
        type: 'group',
        name: 'header',
        style: {
          flex: '0 0 auto',
          display: 'flex',
          'align-items': 'center',
        },
        components: [
          {
            type: 'text',
            name: 'room',
            opts: { text: { key: 'options.room_name' } },
            style: {
              flex: '1 1 auto',
              'font-size': '5.6em',
              'font-weight': '600',
            },
          },
          {
            type: 'text',
            name: 'clock',
            opts: { text: { fmt: "{@now | date:'HH:mm'}" } },
            style: {
              flex: '0 0 auto',
              width: 'auto',
              'font-size': '5.6em',
              opacity: 0.8,
            },
          },
        ],
      },
      {
        type: 'text',
        name: 'status',
        opts: {
          text: {
            switch: {
              key: 'data.status',
              cases: { busy: 'In use', default: 'Available' },
            },
          },
        },
        style: {
          flex: '0 0 auto',
          'margin-top': '0.4em',
          'font-size': '16em',
          'font-weight': '700',
        },
      },
      {
        type: 'text',
        name: 'current',
        when: { key: 'data.current' },
        opts: {
          text: {
            fmt: "{data.current.title} until {data.current.end | date:'HH:mm'}",
          },
        },
        style: { flex: '0 0 auto', 'font-size': '5.6em', opacity: 0.9 },
      },
      {
        type: 'group',
        name: 'next',
        when: { key: 'data.upcoming' },
        style: {
          flex: '1 1 auto',
          display: 'flex',
          'flex-direction': 'column',
          'justify-content': 'flex-end',
        },
        components: [
          {
            type: 'text',
            name: 'next-label',
            opts: { text: 'Later today' },
            style: {
              flex: '0 0 auto',
              'font-size': '3.6em',
              'letter-spacing': '0.15em',
              'text-transform': 'uppercase',
              opacity: 0.7,
            },
          },
          {
            type: 'text',
            name: 'next-list',
            opts: {
              text: {
                list: {
                  key: 'data.upcoming',
                  sort: '$.start',
                  limit: 3,
                  item: {
                    fmt: "{$.start | date:'HH:mm'}-{$.end | date:'HH:mm'}  {$.title}",
                  },
                  join: '\n',
                },
              },
            },
            style: {
              flex: '0 0 auto',
              'margin-top': '0.6em',
              'font-size': '4.8em',
              'line-height': '1.5em',
              'white-space': 'pre-line',
            },
          },
        ],
      },
    ],
  },
};

export const meetingRoomOptions = {
  room_name: 'Room 4.02 - Fjord',
};

export const meetingRoomData = {
  status: 'busy',
  current: {
    title: 'Quarterly planning',
    start: '2026-03-02T13:00:00',
    end: '2026-03-02T14:30:00',
  },
  upcoming: [
    {
      title: 'Design review',
      start: '2026-03-02T16:00:00',
      end: '2026-03-02T17:00:00',
    },
    {
      title: 'Interview',
      start: '2026-03-02T15:00:00',
      end: '2026-03-02T15:45:00',
    },
  ],
};

export const departuresWidget = {
  name: 'Departures board',
  template: {
    type: 'group',
    name: 'root',
    fontScale: true,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'flex-direction': 'column',
      'font-family': FONT,
      color: '#f8fafc',
      background: '#0b1d3a',
    },
    components: [
      {
        type: 'group',
        name: 'header',
        style: {
          flex: '0 0 auto',
          display: 'flex',
          'align-items': 'center',
          height: '16em',
          padding: '0 6em',
          background: '#13294b',
        },
        components: [
          {
            type: 'text',
            name: 'station',
            opts: { text: { fmt: 'Departures - {options.station}' } },
            style: {
              flex: '1 1 auto',
              'font-size': '6em',
              'font-weight': '700',
            },
          },
          {
            type: 'text',
            name: 'clock',
            opts: { text: { fmt: "{@now | date:'HH:mm'}" } },
            style: {
              flex: '0 0 auto',
              width: 'auto',
              'font-size': '6em',
              color: '#fbbf24',
            },
          },
        ],
      },
      {
        type: 'paginated-list',
        name: 'departures',
        opts: {
          items: { list: { key: 'data.departures', sort: '$.time' } },
          pageSize: 6,
          pageDuration: 8,
        },
        style: { flex: '1 1 auto', 'min-height': '0', padding: '0 6em' },
        component: {
          type: 'group',
          name: 'row',
          style: {
            display: 'flex',
            'align-items': 'center',
            height: '14em',
            'border-bottom': '0.2em solid #1e3a66',
          },
          components: [
            {
              type: 'text',
              name: 'time',
              opts: { text: { fmt: "{$.time | date:'HH:mm'}" } },
              style: {
                flex: '0 0 auto',
                width: '14em',
                'font-size': '5em',
                'font-weight': '700',
                color: '#fbbf24',
              },
            },
            {
              type: 'text',
              name: 'line',
              opts: { text: { key: '$.line' } },
              style: {
                flex: '0 0 auto',
                width: '2.6em',
                'margin-right': '0.8em',
                padding: '0.2em 0',
                'border-radius': '0.3em',
                'font-size': '4.4em',
                'font-weight': '700',
                'text-align': 'center',
                color: '#ffffff',
                background: { key: '$.color', default: '#475569' },
              },
            },
            {
              type: 'text',
              name: 'destination',
              opts: { text: { key: '$.destination' } },
              style: { flex: '1 1 auto', 'font-size': '5em' },
            },
            {
              type: 'text',
              name: 'platform',
              opts: { text: { fmt: 'Track {$.platform}' } },
              style: {
                flex: '0 0 auto',
                width: '20%',
                'font-size': '4.2em',
                color: '#cbd5e1',
              },
            },
            {
              type: 'text',
              name: 'status',
              opts: {
                text: {
                  switch: {
                    key: '$.status',
                    cases: {
                      delayed: { fmt: '+{$.delay} min' },
                      cancelled: 'Cancelled',
                      default: 'On time',
                    },
                  },
                },
              },
              style: {
                flex: '0 0 auto',
                width: '18%',
                'font-size': '4.2em',
                'font-weight': '700',
                'text-align': 'right',
                color: {
                  switch: {
                    key: '$.status',
                    cases: {
                      delayed: '#fb923c',
                      cancelled: '#f87171',
                      default: '#4ade80',
                    },
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
};

export const departuresOptions = {
  station: 'Central Station',
};

export const departuresData = {
  departures: [
    {
      time: '2026-03-02T14:05:00',
      line: 'S1',
      color: '#2563eb',
      destination: 'Airport',
      platform: '3',
      status: 'on-time',
    },
    {
      time: '2026-03-02T14:08:00',
      line: 'R4',
      color: '#16a34a',
      destination: 'Harbour',
      platform: '1',
      status: 'delayed',
      delay: 5,
    },
    {
      time: '2026-03-02T14:12:00',
      line: 'S3',
      color: '#9333ea',
      destination: 'University',
      platform: '4',
      status: 'on-time',
    },
    {
      time: '2026-03-02T14:15:00',
      line: 'IC',
      color: '#dc2626',
      destination: 'Northgate',
      platform: '6',
      status: 'cancelled',
    },
    {
      time: '2026-03-02T14:21:00',
      line: 'S1',
      color: '#2563eb',
      destination: 'Old Town',
      platform: '2',
      status: 'on-time',
    },
    {
      time: '2026-03-02T14:24:00',
      line: 'R7',
      color: '#ea580c',
      destination: 'Lakeside',
      platform: '5',
      status: 'on-time',
    },
    {
      time: '2026-03-02T14:30:00',
      line: 'S3',
      color: '#9333ea',
      destination: 'Stadium',
      platform: '4',
      status: 'delayed',
      delay: 2,
    },
    {
      time: '2026-03-02T14:36:00',
      line: 'R4',
      color: '#16a34a',
      destination: 'Riverside',
      platform: '1',
      status: 'on-time',
    },
  ],
};
