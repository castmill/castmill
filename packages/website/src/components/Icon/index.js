import React from 'react';
/**
 * Small stroke icon set used by documentation cards and the homepage.
 * Every icon is drawn on a 24x24 grid and inherits `currentColor`.
 */
const ICONS = {
    rocket: (<>
      <path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9-.8-.8-2.1-.8-2.9-.1Z"/>
      <path d="M12 15 9 12a17 17 0 0 1 2-4 11 11 0 0 1 10-5c0 3-.9 7.4-5 10a18 18 0 0 1-4 2Z"/>
      <path d="M9 12H5s.6-2.8 2-4c1.6-1.1 5 0 5 0"/>
      <path d="M12 15v4s2.8-.6 4-2c1.1-1.6 0-5 0-5"/>
    </>),
    book: (<>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z"/>
      <path d="M8 7h8M8 11h6"/>
    </>),
    monitor: (<>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </>),
    layers: (<>
      <path d="m12 2 10 5-10 5L2 7l10-5Z"/>
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>
    </>),
    playlist: (<>
      <path d="M3 6h12M3 12h12M3 18h8"/>
      <path d="m17 14 5 3-5 3v-6Z"/>
    </>),
    calendar: (<>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 18h6"/>
    </>),
    image: (<>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>
    </>),
    widget: (<>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <path d="M17.5 14v7M14 17.5h7"/>
    </>),
    layout: (<>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 15h18M14 3v12"/>
    </>),
    users: (<>
      <circle cx="9" cy="8" r="4"/>
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/>
      <path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7"/>
    </>),
    shield: (<>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
      <path d="m9 12 2 2 4-4"/>
    </>),
    server: (<>
      <rect x="2" y="3" width="20" height="8" rx="2"/>
      <rect x="2" y="13" width="20" height="8" rx="2"/>
      <path d="M6 7h.01M6 17h.01"/>
    </>),
    code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>,
    plug: (<>
      <path d="M12 22v-5M9 8V2M15 8V2"/>
      <path d="M18 8v5a6 6 0 0 1-12 0V8h12Z"/>
    </>),
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>,
    rss: (<>
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>
      <circle cx="5" cy="19" r="1"/>
    </>),
    bot: (<>
      <rect x="4" y="8" width="16" height="12" rx="2"/>
      <path d="M12 8V4M8 4h8M2 14h2M20 14h2M9 13v2M15 13v2"/>
    </>),
    tag: (<>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/>
      <circle cx="7.5" cy="7.5" r="1"/>
    </>),
    bell: (<>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>
    </>),
    chart: (<>
      <path d="M3 3v18h18"/>
      <path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>
    </>),
    settings: (<>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>
    </>),
    globe: (<>
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>
    </>),
    terminal: (<>
      <path d="m4 17 6-6-6-6M12 19h8"/>
    </>),
    help: (<>
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>
    </>),
    wifiOff: (<>
      <path d="m2 2 20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M16.8 11.1a10 10 0 0 1 2.2 1.8M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M12 20h.01"/>
    </>),
    clock: (<>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </>),
    database: (<>
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>
    </>),
    lock: (<>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </>),
    rotate: (<>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
      <path d="M21 3v5h-5"/>
    </>),
};
export default function Icon({ name, className, }) {
    return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>);
}
