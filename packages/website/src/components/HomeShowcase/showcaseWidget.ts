// Template widget rendered live by the Castmill player on the homepage.
// It uses the same JSON format as any widget uploaded to the dashboard.
//
// The player loops a widget over its duration. Every animated element enters,
// holds and fades out just before the end, so the loop restarts from an empty
// background instead of snapping back. The agenda boxes slide in from the left,
// the bottom and the right of the screen. The background glow drifts away and
// returns over exactly one cycle.

/** Length of one cycle, in seconds. Passed to the player as the `duration` option. */
export const SHOWCASE_DURATION = 14;

export const showcaseOptions = { duration: SHOWCASE_DURATION };

const enterAndExit = (
  startMs: number,
  // Where the element comes from; by default it rises a little while fading in.
  from: Record<string, number> = { y: 14 },
  duration = 1
) => [
  {
    keyframes: [
      { from: { opacity: 0, ...from, duration, ease: 'power3.out' } },
    ],
    start: startMs,
  },
  {
    keyframes: [
      { to: { opacity: 0, y: -6, duration: 0.6, ease: 'power1.in' } },
    ],
    // Finishes 0.2 s before the loop.
    start: -800,
  },
];

const text = (name: string, value: string, style: Record<string, string>) => ({
  type: 'text',
  name,
  opts: { text: value },
  style: { flex: '0 0 auto', ...style },
});

// Animations go on groups: on a text component they would split it into words.
// Each agenda box slides in from outside the screen (`from`), in percent of its size.
const agendaItem = (
  name: string,
  time: string,
  title: string,
  place: string,
  startMs: number,
  from: Record<string, number>
) => ({
  type: 'group',
  name,
  style: {
    flex: '1 1 0',
    display: 'flex',
    'flex-direction': 'column',
    padding: '0.9em 1em',
    'border-radius': '0.6em',
    'background-color': 'rgba(255, 255, 255, 0.1)',
    border: '0.06em solid rgba(255, 255, 255, 0.18)',
  },
  animations: enterAndExit(startMs, from, 1.2),
  components: [
    text(`${name}-time`, time, {
      'font-size': '0.8em',
      'font-weight': '700',
      color: '#9cc2ff',
    }),
    text(`${name}-title`, title, {
      'font-size': '1.05em',
      'font-weight': '700',
      color: '#ffffff',
      'margin-top': '0.25em',
    }),
    text(`${name}-place`, place, {
      'font-size': '0.75em',
      color: 'rgba(255, 255, 255, 0.7)',
      'margin-top': '0.2em',
    }),
  ],
});

const line = (name: string, startMs: number, child: object) => ({
  type: 'group',
  name,
  animations: enterAndExit(startMs),
  components: [child],
});

export const showcaseWidget = {
  name: 'Lobby welcome',
  description: 'Welcome screen with the day agenda',
  template: {
    type: 'group',
    name: 'lobby',
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      'font-family':
        'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      background:
        'linear-gradient(135deg, #0d1630 0%, #173a86 55%, #2f6fdb 100%)',
    },
    components: [
      {
        type: 'group',
        name: 'glow',
        style: {
          position: 'absolute',
          top: '-35%',
          right: '-20%',
          width: '70%',
          height: '140%',
          'border-radius': '50%',
          background:
            'radial-gradient(closest-side, rgba(140, 185, 255, 0.35), rgba(140, 185, 255, 0))',
        },
        animations: [
          {
            keyframes: [
              {
                to: {
                  xPercent: -18,
                  yPercent: 10,
                  duration: SHOWCASE_DURATION / 2,
                  ease: 'sine.inOut',
                },
              },
              {
                to: {
                  xPercent: 0,
                  yPercent: 0,
                  duration: SHOWCASE_DURATION / 2,
                  ease: 'sine.inOut',
                },
              },
            ],
          },
        ],
      },
      {
        type: 'group',
        name: 'content',
        style: {
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          'flex-direction': 'column',
          'justify-content': 'space-between',
          padding: '1.6em 1.8em',
          'box-sizing': 'border-box',
        },
        components: [
          {
            type: 'group',
            name: 'heading',
            components: [
              line(
                'eyebrow',
                200,
                text('eyebrow-text', 'WEDNESDAY · 12 NOVEMBER', {
                  'font-size': '0.75em',
                  'font-weight': '700',
                  'letter-spacing': '0.18em',
                  color: '#9cc2ff',
                })
              ),
              line(
                'welcome',
                400,
                text('welcome-text', 'Welcome to the Stockholm office', {
                  'font-size': '1.9em',
                  'font-weight': '800',
                  'line-height': '1.15',
                  color: '#ffffff',
                  'margin-top': '0.3em',
                })
              ),
            ],
          },
          {
            type: 'group',
            name: 'agenda',
            style: { display: 'flex', 'flex-direction': 'row', gap: '0.8em' },
            components: [
              agendaItem('a1', '09:30', 'All hands', 'Auditorium', 900, {
                xPercent: -140,
              }),
              agendaItem('a2', '12:00', 'Team lunch', 'Level 2', 1050, {
                yPercent: 280,
              }),
              agendaItem('a3', '16:00', 'Demo day', 'Studio B', 1200, {
                xPercent: 140,
              }),
            ],
          },
          line(
            'footer',
            1700,
            text(
              'footer-text',
              'Wi-Fi: Guest · Ask reception for a visitor badge',
              {
                'font-size': '0.7em',
                color: 'rgba(255, 255, 255, 0.65)',
              }
            )
          ),
        ],
      },
    ],
  },
};

/** The same widget without animations, for visitors who prefer reduced motion. */
export const stillShowcaseWidget = {
  ...showcaseWidget,
  template: JSON.parse(
    JSON.stringify(showcaseWidget.template, (key, value) =>
      key === 'animations' ? undefined : value
    )
  ),
};
