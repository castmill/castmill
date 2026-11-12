// Template widget rendered live by the Castmill player on the homepage.
// It uses the same JSON format as any widget uploaded to the dashboard.
const fadeUp = (delayMs) => [
    {
        keyframes: [
            { from: { y: 24, opacity: 0 } },
            { to: { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' } },
        ],
        start: delayMs,
    },
];
const agendaItem = (name, time, title, place, delayMs) => ({
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
    animations: fadeUp(delayMs),
    components: [
        {
            type: 'text',
            name: `${name}-time`,
            opts: { text: time },
            style: {
                flex: '0 0 auto',
                'font-size': '0.8em',
                'font-weight': '700',
                color: '#9cc2ff',
            },
        },
        {
            type: 'text',
            name: `${name}-title`,
            opts: { text: title },
            style: {
                flex: '0 0 auto',
                'font-size': '1.05em',
                'font-weight': '700',
                color: '#ffffff',
                'margin-top': '0.25em',
            },
        },
        {
            type: 'text',
            name: `${name}-place`,
            opts: { text: place },
            style: {
                flex: '0 0 auto',
                'font-size': '0.75em',
                color: 'rgba(255, 255, 255, 0.7)',
                'margin-top': '0.2em',
            },
        },
    ],
});
export const showcaseWidget = {
    name: 'Lobby welcome',
    description: 'Welcome screen with the day agenda',
    template: {
        type: 'group',
        name: 'lobby',
        style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            'flex-direction': 'column',
            'justify-content': 'space-between',
            padding: '1.6em 1.8em',
            'box-sizing': 'border-box',
            'font-family': 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            background: 'linear-gradient(135deg, #0d1630 0%, #173a86 55%, #2f6fdb 100%)',
        },
        components: [
            {
                type: 'group',
                name: 'heading',
                components: [
                    {
                        type: 'text',
                        name: 'eyebrow',
                        opts: { text: 'WEDNESDAY · 12 NOVEMBER' },
                        style: {
                            flex: '0 0 auto',
                            'font-size': '0.75em',
                            'font-weight': '700',
                            'letter-spacing': '0.18em',
                            color: '#9cc2ff',
                        },
                        animations: fadeUp(0),
                    },
                    {
                        type: 'text',
                        name: 'welcome',
                        opts: { text: 'Welcome to the Stockholm office' },
                        style: {
                            flex: '0 0 auto',
                            'font-size': '1.9em',
                            'font-weight': '800',
                            'line-height': '1.15',
                            color: '#ffffff',
                            'margin-top': '0.3em',
                        },
                        animations: fadeUp(150),
                    },
                ],
            },
            {
                type: 'group',
                name: 'agenda',
                style: { display: 'flex', 'flex-direction': 'row', gap: '0.8em' },
                components: [
                    agendaItem('a1', '09:30', 'All hands', 'Auditorium', 400),
                    agendaItem('a2', '12:00', 'Team lunch', 'Level 2', 550),
                    agendaItem('a3', '16:00', 'Demo day', 'Studio B', 700),
                ],
            },
            {
                type: 'text',
                name: 'footer',
                opts: { text: 'Wi-Fi: Guest · Ask reception for a visitor badge' },
                style: {
                    flex: '0 0 auto',
                    'font-size': '0.7em',
                    color: 'rgba(255, 255, 255, 0.65)',
                },
                animations: fadeUp(900),
            },
        ],
    },
};
