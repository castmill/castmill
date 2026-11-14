// Seeds the demo network created by bootstrap.exs with the content shown in
// the documentation screenshots: Harbor Kitchen's media, tags, layouts,
// playlists, channels, devices (real browser players), teams, invitations,
// feeds, automations and AI agent, plus some content in the other
// organizations.
//
//     cd packages/website
//     node scripts/screenshots/seed.mjs
//
// Everything is created through the dashboard API with the payloads the
// dashboard sends. The script is idempotent: it looks resources up by name and
// only creates what is missing. It writes the ids under `seed` in .demo.json.

// Automation rules use the API's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateMedia } from './media.mjs';
import { DEMO_PLAYERS, launchBrowser, registerPlayer } from './players.mjs';

const DIR = import.meta.dirname;
const DEMO_FILE = path.join(DIR, '.demo.json');
const MEDIA_DIR = path.join(DIR, '.cache', 'media');
const API_URL = process.env.CASTMILL_API_URL ?? 'http://localhost:4000';
const TIMEZONE = 'Europe/Stockholm';
const REPEAT_WEEKLY_UNTIL = '2027-12-31';

const demo = JSON.parse(readFileSync(DEMO_FILE, 'utf8'));
// The dashboard API resolves the network from the dashboard's Origin.
const ORIGIN = `http://${demo.domain}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const byName = (items) => new Map(items.map((item) => [item.name, item]));
const log = (message) => console.log(message);

function summary(label, names, created) {
  log(`${label}: ${names.length}${created ? ` (${created} new)` : ''}`);
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(method, url, status, body) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    super(
      `${method} ${url} failed with HTTP ${status}: ${detail?.slice(0, 400)}`
    );
    this.status = status;
  }
}

function client(token) {
  const request = async (method, url, body) => {
    const headers = { Authorization: `Bearer ${token}`, Origin: ORIGIN };
    const init = { method, headers };
    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_URL}${url}`, init);
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON.
    }
    if (!response.ok) throw new ApiError(method, url, response.status, data);
    return data;
  };

  return {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    patch: (url, body) => request('PATCH', url, body),
    delete: (url) => request('DELETE', url),
  };
}

/** A client for the routes under /dashboard/organizations/:id. */
function organization(name, userKey) {
  const id = demo.organizations[name];
  const http = client(demo.tokens[userKey]);
  const base = `/dashboard/organizations/${id}`;
  return {
    id,
    name,
    http,
    get: (url) => http.get(base + url),
    post: (url, body) => http.post(base + url, body),
    put: (url, body) => http.put(base + url, body),
    patch: (url, body) => http.patch(base + url, body),
    delete: (url) => http.delete(base + url),
    list: async (resource) =>
      (await http.get(`${base}/${resource}?page=1&page_size=100`)).data,
  };
}

const ids = (map) =>
  Object.fromEntries([...map].map(([name, item]) => [name, item.id]));

// ---------------------------------------------------------------------------
// Time helpers (channel entries are UTC instants of local channel times)
// ---------------------------------------------------------------------------

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(timestamp);
  const get = (type) => parts.find((part) => part.type === type).value;
  return {
    year: +get('year'),
    month: +get('month'),
    day: +get('day'),
    hour: +get('hour'),
    minute: +get('minute'),
    second: +get('second'),
    weekday:
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
        get('weekday')
      ) + 1,
  };
}

function zonedTime({ year, month, day }, time, timeZone) {
  const [hour, minute] = time.split(':').map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute);
  const offset = (ts) => {
    const p = zonedParts(ts, timeZone);
    return (
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts
    );
  };
  const guess = local - offset(local);
  return local - offset(guess);
}

/** The local date of the given ISO weekday (1 = Monday) in the current week. */
function dateInCurrentWeek(weekday, timeZone) {
  const today = zonedParts(Date.now(), timeZone);
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day));
  date.setUTCDate(date.getUTCDate() + weekday - today.weekday);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

const hhmm = (p) =>
  `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Generic resources
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

/** Uploads the missing media ([name, file]) and waits until all are ready. */
async function ensureMedia(org, entries, files) {
  const existing = byName(await org.list('medias'));
  let created = 0;
  for (const [name, file] of entries) {
    if (existing.has(name)) continue;
    const extension = path.extname(file);
    const form = new FormData();
    form.append(
      'file',
      new Blob([readFileSync(files[file])], { type: MIME_TYPES[extension] }),
      `${name}${extension}`
    );
    await org.post('/medias', form);
    created++;
  }

  const deadline = Date.now() + 5 * 60_000;
  for (;;) {
    const media = byName(await org.list('medias'));
    const failed = entries.filter(
      ([name]) => media.get(name)?.status === 'failed'
    );
    if (failed.length) {
      throw new Error(
        `Transcoding failed: ${failed.map(([name]) => name).join(', ')}`
      );
    }
    const pending = entries.filter(
      ([name]) => media.get(name)?.status !== 'ready'
    );
    if (!pending.length) {
      summary(`${org.name} media`, entries, created);
      return new Map(entries.map(([name]) => [name, media.get(name)]));
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Media not ready: ${pending.map(([name]) => name).join(', ')}`
      );
    }
    await sleep(2000);
  }
}

/** Default option values of a widget, as the dashboard's widget form sets them. */
function defaultOptions(widget) {
  return Object.fromEntries(
    Object.entries(widget.options_schema ?? {})
      .filter(
        ([, schema]) =>
          schema && typeof schema === 'object' && 'default' in schema
      )
      .map(([key, schema]) => [key, schema.default])
  );
}

async function widgetsBySlug(org) {
  const { data } = await org.get('/widgets?page=1&page_size=100');
  return new Map(data.map((widget) => [widget.slug, widget]));
}

const image = (media, seconds) => ({
  widget: 'image',
  duration: seconds * 1000,
  options: { image: media.id, duration: seconds },
});

// Players schedule video items with the video's length.
const video = (media) => ({
  widget: 'video',
  duration: media.meta?.duration ?? 0,
  options: { video: media.id },
});

const qrCode = (content, caption, seconds = 10) => ({
  widget: 'qr-code',
  duration: seconds * 1000,
  options: { content, caption, duration: seconds },
});

const itemSignature = (items) =>
  items.map((item) => `${item.widgetId}:${item.duration}`).join('|');

/**
 * Creates the playlist if needed and makes its items match `items`. Items are
 * rebuilt only when the widgets or durations differ.
 */
async function ensurePlaylist(
  org,
  widgets,
  existing,
  { name, aspectRatio },
  items
) {
  let playlist = existing.get(name);
  let created = false;
  if (!playlist) {
    const [width, height] = aspectRatio.split(':').map(Number);
    ({ data: playlist } = await org.post('/playlists', {
      playlist: { name, settings: { aspect_ratio: { width, height } } },
    }));
    created = true;
  }

  const wanted = items.map((item) => ({
    ...item,
    widgetId: widgets.get(item.widget).id,
  }));
  const { data: current } = await org.get(`/playlists/${playlist.id}`);
  const currentItems = current.items.map((item) => ({
    id: item.id,
    widgetId: item.widget.id,
    duration: item.duration,
  }));

  if (itemSignature(currentItems) !== itemSignature(wanted)) {
    for (const item of currentItems) {
      await org.delete(`/playlists/${playlist.id}/items/${item.id}`);
    }
    let previous = null;
    for (const item of wanted) {
      const { data } = await org.post(`/playlists/${playlist.id}/items`, {
        widget_id: item.widgetId,
        offset: 0,
        duration: item.duration,
        options: {
          ...defaultOptions(widgets.get(item.widget)),
          ...item.options,
        },
        prev_item_id: previous,
      });
      previous = data.id;
    }
  }
  return { playlist, created };
}

/** `items` may be a function of the playlists ensured before it. */
async function ensurePlaylists(org, widgets, specs) {
  const existing = byName(await org.list('playlists'));
  const result = new Map();
  let created = 0;
  for (const spec of specs) {
    const items =
      typeof spec.items === 'function' ? spec.items(result) : spec.items;
    const { playlist, created: isNew } = await ensurePlaylist(
      org,
      widgets,
      existing,
      spec,
      items
    );
    result.set(spec.name, playlist);
    if (isNew) created++;
  }
  summary(`${org.name} playlists`, specs, created);
  return result;
}

async function ensureChannels(org, specs, playlists) {
  const existing = byName(await org.list('channels'));
  const result = new Map();
  let created = 0;
  for (const { name, timezone, defaultPlaylist } of specs) {
    let channel = existing.get(name);
    if (!channel) {
      ({ data: channel } = await org.post('/channels', {
        channel: { name, timezone },
      }));
      created++;
    }
    const defaultPlaylistId = playlists.get(defaultPlaylist)?.id;
    if (
      defaultPlaylistId &&
      channel.default_playlist_id !== defaultPlaylistId
    ) {
      await org.patch(`/channels/${channel.id}`, {
        update: { id: channel.id, default_playlist_id: defaultPlaylistId },
      });
    }
    result.set(name, channel);
  }
  summary(`${org.name} channels`, specs, created);
  return result;
}

/**
 * Makes the weekly entries of a channel match `schedule`
 * ([weekdays, playlist name, start, end] in the channel's local time). The
 * entries start in the current week and repeat weekly. Entries are compared
 * by weekday and time, so later runs keep entries created in earlier weeks.
 */
async function ensureChannelEntries(org, channel, schedule, playlists) {
  const wanted = schedule.flatMap(([weekdays, playlistName, start, end]) =>
    weekdays.map((weekday) => ({
      playlistId: playlists.get(playlistName).id,
      weekday,
      start,
      end,
    }))
  );
  const key = ({ playlistId, weekday, start, end }) =>
    `${playlistId}|${weekday}|${start}|${end}`;

  const current = await org.get(
    `/channels/${channel.id}/entries?start_date=0&end_date=${Date.UTC(2100, 0, 1)}`
  );
  const currentKeys = current.map((entry) => {
    const start = zonedParts(Date.parse(entry.start), channel.timezone);
    const end = zonedParts(Date.parse(entry.end), channel.timezone);
    return key({
      playlistId: entry.playlist_id,
      weekday: start.weekday,
      start: hhmm(start),
      end: hhmm(end),
    });
  });
  const wantedKeys = wanted.map(key);
  if (
    entriesMatch(currentKeys, wantedKeys) &&
    current.every((entry) => entry.repeat_weekly_until === REPEAT_WEEKLY_UNTIL)
  ) {
    return { count: current.length, created: 0 };
  }

  for (const entry of current) {
    await org.delete(`/channels/${channel.id}/entries/${entry.id}`);
  }
  for (const { playlistId, weekday, start, end } of wanted) {
    const date = dateInCurrentWeek(weekday, channel.timezone);
    await org.post(`/channels/${channel.id}/entries`, {
      playlist_id: playlistId,
      start: zonedTime(date, start, channel.timezone),
      end: zonedTime(date, end, channel.timezone),
      repeat_weekly_until: REPEAT_WEEKLY_UNTIL,
    });
  }
  return { count: wanted.length, created: wanted.length };
}

const entriesMatch = (a, b) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function setTags(org, resourceType, resourceId, tagNames, tags) {
  const tagIds = tagNames.map((name) => tags.get(name).id);
  const { data: current } = await org.get(
    `/${resourceType}/${resourceId}/tags`
  );
  if (
    entriesMatch(
      current.map((tag) => String(tag.id)),
      tagIds.map(String)
    )
  )
    return;
  await org.put(`/${resourceType}/${resourceId}/tags`, { tag_ids: tagIds });
}

// ---------------------------------------------------------------------------
// Harbor Kitchen
// ---------------------------------------------------------------------------

const HK_MEDIA = [
  ['Lunch specials', 'lunch-specials.jpg'],
  ['Happy hour', 'happy-hour.jpg'],
  ['Soup of the week', 'seasonal-soup.jpg'],
  ['Weekend brunch', 'weekend-brunch.jpg'],
  ['Cardamom buns', 'cardamom-buns.jpg'],
  ['We are hiring', 'now-hiring.jpg'],
  ['Free Wi-Fi', 'free-wifi.png'],
  ['Allergen information', 'allergen-info.jpg'],
  ['Harbor Kitchen logo', 'harbor-kitchen-logo.png'],
  ['Coffee of the month', 'coffee-of-the-month.jpg'],
  ['Kitchen highlights', 'kitchen-highlights.mp4'],
];

// Tag colours are indexes into the API's palette (GET /tags/colors).
const TAG_GROUPS = [
  {
    name: 'Location',
    color: 0,
    tags: [
      ['Downtown', 0],
      ['Airport', 6],
      ['Harbor Front', 1],
    ],
  },
  {
    name: 'Campaign',
    color: 2,
    tags: [
      ['Lunch', 2],
      ['Happy hour', 5],
      ['Brunch', 4],
      ['Seasonal', 3],
    ],
  },
  { name: null, tags: [['Evergreen', 7]] },
];

// Tag.color_palette, used if the palette endpoint is not available.
const FALLBACK_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#6B7280',
];

const MEDIA_TAGS = {
  'Lunch specials': ['Lunch'],
  'Soup of the week': ['Lunch', 'Seasonal'],
  'Happy hour': ['Happy hour'],
  'Weekend brunch': ['Brunch'],
  'Cardamom buns': ['Brunch'],
  'Coffee of the month': ['Seasonal'],
  'Free Wi-Fi': ['Evergreen'],
  'Allergen information': ['Evergreen'],
  'We are hiring': ['Evergreen'],
  'Harbor Kitchen logo': ['Evergreen'],
};

const PLAYLIST_TAGS = {
  'Lunch menu': ['Lunch'],
  'Happy hour': ['Happy hour'],
  'Weekend brunch': ['Brunch'],
  'Lobby welcome': ['Evergreen'],
  'Coffee corner': ['Seasonal'],
  'Counter screen': ['Airport', 'Lunch'],
};

const CHANNEL_TAGS = {
  Downtown: ['Downtown'],
  Airport: ['Airport'],
  'Harbor Front': ['Harbor Front'],
};

const DEVICE_SETUP = {
  'downtown-menu-board': {
    channel: 'Downtown',
    tags: ['Downtown', 'Lunch'],
    description: 'Menu board above the order counter',
    // Opening hours; days are 0 (Monday) to 6 (Sunday).
    schedule: [
      {
        startHour: 7,
        startMinute: 0,
        endHour: 22,
        endMinute: 0,
        days: [0, 1, 2, 3, 4],
      },
      { startHour: 9, startMinute: 0, endHour: 22, endMinute: 0, days: [5, 6] },
    ],
  },
  'downtown-window': {
    channel: 'Downtown',
    tags: ['Downtown', 'Happy hour'],
    description: 'Street-facing window screen',
  },
  'airport-gate-12': {
    channel: 'Airport',
    tags: ['Airport'],
    description: 'Portrait screen next to the gate entrance',
  },
  'harbor-front-counter': {
    channel: 'Harbor Front',
    tags: ['Harbor Front'],
    description: 'Screen behind the coffee counter',
  },
};

const LAYOUTS = [
  {
    name: 'Menu board with sidebar',
    description: 'Menu on the left, two promotions on the right',
    aspect_ratio: '16:9',
    zones: [
      ['zone-main', 'Main', 0, 0, 70, 100],
      ['zone-sidebar-top', 'Sidebar top', 70, 0, 30, 50],
      ['zone-sidebar-bottom', 'Sidebar bottom', 70, 50, 30, 50],
    ],
  },
  {
    name: 'Portrait split',
    description: 'Large content on top, a smaller area below',
    aspect_ratio: '9:16',
    zones: [
      ['zone-top', 'Top', 0, 0, 100, 60],
      ['zone-bottom', 'Bottom', 0, 60, 100, 40],
    ],
  },
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];
const STORE_SCHEDULE = [
  [WEEKDAYS, 'Lunch menu', '11:30', '14:00'],
  [WEEKDAYS, 'Happy hour', '15:00', '17:00'],
  [WEEKEND, 'Weekend brunch', '10:00', '14:00'],
];
// Entries of a channel cannot overlap, so on weekends the Airport serves lunch
// after brunch.
const CHANNEL_SCHEDULES = {
  Downtown: STORE_SCHEDULE,
  'Harbor Front': STORE_SCHEDULE,
  Airport: [
    [WEEKDAYS, 'Counter screen', '07:00', '10:00'],
    [WEEKDAYS, 'Lunch menu', '11:00', '15:00'],
    [WEEKEND, 'Weekend brunch', '10:00', '14:00'],
    [WEEKEND, 'Lunch menu', '14:00', '15:00'],
  ],
};

async function seedTags(org) {
  let palette = FALLBACK_PALETTE;
  try {
    ({ data: palette } = await org.get('/tags/colors'));
  } catch {
    // Some versions restrict the palette endpoint; it matches the fallback.
  }

  const groups = byName((await org.get('/tag-groups')).data);
  const tags = byName((await org.get('/tags')).data);
  let created = 0;

  for (const group of TAG_GROUPS) {
    let groupId = null;
    if (group.name) {
      let tagGroup = groups.get(group.name);
      if (!tagGroup) {
        ({ data: tagGroup } = await org.post('/tag-groups', {
          name: group.name,
          color: palette[group.color],
        }));
        groups.set(group.name, tagGroup);
        created++;
      }
      groupId = tagGroup.id;
    }
    for (const [position, [name, color]] of group.tags.entries()) {
      if (tags.has(name)) continue;
      const { data: tag } = await org.post('/tags', {
        name,
        color: palette[color],
        position,
        tag_group_id: groupId,
      });
      tags.set(name, tag);
      created++;
    }
  }
  summary(
    `${org.name} tag groups and tags`,
    [...groups.keys(), ...tags.keys()],
    created
  );
  return { groups, tags };
}

async function seedLayouts(org) {
  const existing = byName(await org.list('layouts'));
  let created = 0;
  for (const layout of LAYOUTS) {
    if (existing.has(layout.name)) continue;
    const { data } = await org.post('/layouts', {
      layout: {
        name: layout.name,
        description: layout.description,
        aspect_ratio: layout.aspect_ratio,
        zones: {
          zones: layout.zones.map(([id, name, x, y, width, height]) => ({
            id,
            name,
            rect: { x, y, width, height },
            zIndex: 1,
          })),
        },
      },
    });
    existing.set(layout.name, data);
    created++;
  }
  summary(`${org.name} layouts`, LAYOUTS, created);
  return new Map(LAYOUTS.map(({ name }) => [name, existing.get(name)]));
}

async function seedHarborPlaylists(org, widgets, media, layouts) {
  const m = (name) => media.get(name);
  return ensurePlaylists(org, widgets, [
    {
      name: 'Lunch menu',
      aspectRatio: '16:9',
      items: [
        image(m('Lunch specials'), 10),
        image(m('Soup of the week'), 8),
        video(m('Kitchen highlights')),
        image(m('Cardamom buns'), 8),
        qrCode('https://harborkitchen.example/menu', 'Scan for the full menu'),
      ],
    },
    {
      name: 'Happy hour',
      aspectRatio: '16:9',
      items: [
        image(m('Happy hour'), 10),
        image(m('Cardamom buns'), 8),
        image(m('Free Wi-Fi'), 8),
      ],
    },
    {
      name: 'Weekend brunch',
      aspectRatio: '16:9',
      items: [
        image(m('Weekend brunch'), 10),
        image(m('Cardamom buns'), 8),
        video(m('Kitchen highlights')),
      ],
    },
    {
      name: 'Lobby welcome',
      aspectRatio: '16:9',
      items: [
        image(m('Free Wi-Fi'), 8),
        image(m('Allergen information'), 8),
        image(m('We are hiring'), 8),
        qrCode('https://harborkitchen.example/jobs', 'Join our team'),
      ],
    },
    {
      name: 'Coffee corner',
      aspectRatio: '9:16',
      items: [image(m('Coffee of the month'), 12)],
    },
    {
      name: 'Counter screen',
      aspectRatio: '16:9',
      items: (playlists) => [
        layoutItem(layouts.get('Menu board with sidebar'), playlists),
      ],
    },
  ]);
}

// The layout widget's layoutRef, as the dashboard's layout picker builds it.
// Its duration is 0: players use the length of the zone playlists.
function layoutItem(layout, playlists) {
  const zonePlaylists = {
    'zone-main': 'Lunch menu',
    'zone-sidebar-top': 'Lobby welcome',
    'zone-sidebar-bottom': 'Happy hour',
  };
  return {
    widget: 'layout-widget',
    duration: 0,
    options: {
      layoutRef: {
        layoutId: layout.id,
        aspectRatio: layout.aspect_ratio,
        zones: layout.zones,
        zonePlaylistMap: Object.fromEntries(
          Object.entries(zonePlaylists).map(([zone, name]) => [
            zone,
            { playlistId: playlists.get(name).id },
          ])
        ),
      },
    },
  };
}

async function seedHarborChannels(org, playlists) {
  const channels = await ensureChannels(
    org,
    ['Downtown', 'Airport', 'Harbor Front'].map((name) => ({
      name,
      timezone: TIMEZONE,
      defaultPlaylist: 'Lobby welcome',
    })),
    playlists
  );
  let entries = 0;
  let created = 0;
  for (const [name, schedule] of Object.entries(CHANNEL_SCHEDULES)) {
    const result = await ensureChannelEntries(
      org,
      channels.get(name),
      schedule,
      playlists
    );
    entries += result.count;
    created += result.created;
  }
  log(
    `${org.name} channel entries: ${entries}${created ? ` (${created} new)` : ''}`
  );
  return channels;
}

/**
 * Registers the demo players that are not devices yet, the way a user enters a
 * player's code on the Devices page, then makes each device play only its
 * channel. Registration adds a "<device> Default" channel and playlist, which
 * are removed again.
 */
async function seedDevices(org, channels) {
  let devices = byName(await org.list('devices'));
  const missing = DEMO_PLAYERS.filter(({ name }) => !devices.has(name));

  let registered = 0;
  if (missing.length) {
    const browser = await launchBrowser();
    try {
      for (const device of missing) {
        const { player, recovered } = await registerPlayer(
          browser,
          device,
          (pincode) => org.post('/devices', { name: device.name, pincode })
        );
        // The server already knew the player's hardware id, e.g. it was renamed.
        if (recovered) {
          await org.patch(`/devices/${player.deviceId}`, {
            update: { name: device.name },
          });
        } else {
          registered++;
        }
        await player.close();
        log(`  ${recovered ? 'recovered' : 'registered'} ${device.name}`);
      }
    } finally {
      await browser.close();
    }
    devices = byName(await org.list('devices'));
  }

  for (const { slug, name } of DEMO_PLAYERS) {
    const device = devices.get(name);
    const { description, schedule } = DEVICE_SETUP[slug];
    if (device.description !== description) {
      await org.patch(`/devices/${device.id}`, { update: { description } });
    }
    if (schedule) {
      const current = await org.http.get(
        `/dashboard/devices/${device.id}/schedule`
      );
      if (!current?.entries?.length) {
        await org.http.put(`/dashboard/devices/${device.id}/schedule`, {
          entries: schedule,
        });
      }
    }
    const target = channels.get(DEVICE_SETUP[slug].channel);
    const { data: assigned } = await org.http.get(
      `/dashboard/devices/${device.id}/channels`
    );
    if (!assigned.some((channel) => channel.id === target.id)) {
      await org.http.post(`/dashboard/devices/${device.id}/channels`, {
        channel_id: target.id,
      });
    }
    for (const channel of assigned) {
      if (channel.id !== target.id) {
        await org.http.delete(
          `/dashboard/devices/${device.id}/channels/${channel.id}`
        );
      }
    }
  }

  const defaults = new Set(DEMO_PLAYERS.map(({ name }) => `${name} Default`));
  for (const [resource, items] of [
    ['channels', await org.list('channels')],
    ['playlists', await org.list('playlists')],
  ]) {
    for (const item of items.filter(({ name }) => defaults.has(name))) {
      try {
        await org.delete(`/${resource}/${item.id}`);
      } catch (error) {
        if (error.status !== 409) throw error; // Still in use.
      }
    }
  }

  summary(`${org.name} devices`, DEMO_PLAYERS, registered);
  return new Map(DEMO_PLAYERS.map(({ name }) => [name, devices.get(name)]));
}

async function seedTagging(org, tags, { media, playlists, channels, devices }) {
  for (const [name, names] of Object.entries(MEDIA_TAGS)) {
    await setTags(org, 'medias', media.get(name).id, names, tags);
  }
  for (const [name, names] of Object.entries(PLAYLIST_TAGS)) {
    await setTags(org, 'playlists', playlists.get(name).id, names, tags);
  }
  for (const [name, names] of Object.entries(CHANNEL_TAGS)) {
    await setTags(org, 'channels', channels.get(name).id, names, tags);
  }
  for (const { slug, name } of DEMO_PLAYERS) {
    await setTags(
      org,
      'devices',
      devices.get(name).id,
      DEVICE_SETUP[slug].tags,
      tags
    );
  }
  log(`${org.name} tagging: done`);
}

const TEAMS = [
  {
    name: 'Marketing',
    members: ['sam', 'priya'],
    pending: ['taylor.brooks@example.com'],
    resources: ({ playlists, media }) => ({
      playlists: [
        [
          ['Lunch menu', 'Happy hour', 'Weekend brunch'].map(
            (n) => playlists.get(n).id
          ),
          ['read', 'write', 'delete'],
        ],
      ],
      medias: [
        [
          [...media.values()]
            .filter((item) => item.mimetype?.startsWith('image/'))
            .map((item) => item.id),
          ['read', 'write'],
        ],
      ],
    }),
  },
  {
    name: 'Store managers',
    members: ['jordan', 'chris'],
    pending: [],
    resources: ({ devices, channels }) => ({
      devices: [
        [[...devices.values()].map((item) => item.id), ['read', 'write']],
      ],
      channels: [
        [[...channels.values()].map((item) => item.id), ['read', 'write']],
      ],
    }),
  },
];

// The id key of a team resource row, e.g. "playlist_id".
const resourceId = (type, row) => {
  const singular = type === 'medias' ? 'media' : type.replace(/s$/, '');
  return row[`${singular}_id`] ?? row[singular]?.id ?? row.id;
};

/** Finds the token of a team invitation, as the invitee's notification links to it. */
async function invitationToken(org, team, email, inviteeToken) {
  const { data: invitations } = await org.get(
    `/teams/${team.id}/invitations?page=1&page_size=100`
  );
  const invitation = invitations.find(
    (i) => i.email === email && i.status === 'invited'
  );
  if (invitation?.token) return invitation.token;

  const { data: notifications } = await client(inviteeToken).get(
    '/dashboard/notifications?page=1&page_size=100'
  );
  const notification = notifications.find(
    (n) =>
      n.type === 'team_invitation' &&
      String(n.metadata?.team_id) === String(team.id)
  );
  return notification?.metadata?.token;
}

/**
 * Creates the teams. The creator (Alex) becomes a team admin; the other members
 * are invited and accept with their own session, as in the dashboard.
 */
async function seedTeams(org, resources) {
  const existing = byName(await org.list('teams'));
  const { data: members } = await org.get('/members?page=1&page_size=100');
  const emails = new Map(members.map(({ user }) => [user.id, user.email]));
  const result = new Map();
  let created = 0;

  for (const spec of TEAMS) {
    let team = existing.get(spec.name);
    if (!team) {
      ({ data: team } = await org.post('/teams', {
        team: { name: spec.name },
      }));
      created++;
    }
    result.set(spec.name, team);

    const { data: teamMembers } = await org.get(
      `/teams/${team.id}/members?page=1&page_size=100`
    );
    const memberIds = new Set(
      teamMembers.map((member) => member.user_id ?? member.user?.id)
    );
    const { data: invitations } = await org.get(
      `/teams/${team.id}/invitations?page=1&page_size=100`
    );
    const invited = new Set(
      invitations.filter((i) => i.status === 'invited').map((i) => i.email)
    );

    for (const key of spec.members) {
      const userId = demo.users[key];
      if (memberIds.has(userId)) continue;
      const email = emails.get(userId);
      if (!invited.has(email)) {
        await org.post(`/teams/${team.id}/invitations`, {
          email,
          role: 'member',
        });
      }
      const token = await invitationToken(org, team, email, demo.tokens[key]);
      if (!token)
        throw new Error(`No invitation token for ${email} in ${spec.name}`);
      await client(demo.tokens[key]).post(
        `/dashboard/invitations/${token}/accept`
      );
    }
    for (const email of spec.pending) {
      if (!invited.has(email)) {
        await org.post(`/teams/${team.id}/invitations`, {
          email,
          role: 'member',
        });
      }
    }

    for (const [type, grants] of Object.entries(spec.resources(resources))) {
      // The API cannot list a team's devices or channels (HTTP 500) nor add
      // devices to a team (HTTP 400). Without the list, adding a resource the
      // team already has fails with HTTP 400 too.
      let present = null;
      try {
        const { data: rows } = await org.get(
          `/teams/${team.id}/${type}?page=1&page_size=100`
        );
        present = new Set(rows.map((row) => String(resourceId(type, row))));
      } catch (error) {
        if (error.status !== 500) throw error;
      }
      let rejected = 0;
      for (const [resourceIds, access] of grants) {
        for (const id of resourceIds) {
          if (present?.has(String(id))) continue;
          try {
            await org.put(`/teams/${team.id}/${type}/${id}`, { access });
          } catch (error) {
            if (present || error.status !== 400) throw error;
            rejected++;
          }
        }
      }
      if (rejected) {
        log(
          `  ${spec.name}: ${rejected} ${type} not added (already in the team, or unsupported by the API)`
        );
      }
    }
  }
  summary(`${org.name} teams`, TEAMS, created);
  return result;
}

async function seedOrganizationInvitation(org, email, role) {
  const { data } = await org.get('/invitations?page=1&page_size=100');
  if (data.some((i) => i.email === email && i.status === 'invited')) return;
  await org.post('/invitations', { email, role });
  log(`${org.name}: invited ${email}`);
}

async function seedNetworkInvitation(http, organizationName, email, role) {
  const organizationId = demo.organizations[organizationName];
  const invitations = await http.get('/dashboard/network/invitations');
  const exists = invitations.some(
    (i) => i.email === email && i.organization_id === organizationId
  );
  if (exists) return;
  try {
    await http.post(
      `/dashboard/network/organizations/${organizationId}/invitations`,
      {
        email,
        role,
      }
    );
    log(`Network: invited ${email} to ${organizationName}`);
  } catch (error) {
    if (error.status !== 409) throw error; // Already invited.
  }
}

const mediaUrl = (media) =>
  media.files?.main?.uri ??
  media.files?.preview?.uri ??
  media.files?.thumbnail?.uri;

async function seedFeeds(org, media) {
  const specials = [
    [
      'tomato-soup',
      'Roasted tomato soup',
      '95 kr',
      'Slow-roasted tomatoes, basil oil and sourdough croutons',
      'Soup of the week',
    ],
    [
      'baked-salmon',
      'Baked salmon',
      '145 kr',
      'Dill potatoes, lemon butter and seasonal greens',
      'Lunch specials',
    ],
    [
      'halloumi-bowl',
      'Halloumi grain bowl',
      '125 kr',
      'Grilled halloumi, bulgur, roasted vegetables and tahini',
      null,
    ],
    [
      'cardamom-bun',
      'Cardamom bun',
      '39 kr',
      'Baked every morning in our kitchen',
      'Cardamom buns',
    ],
  ].map(([external_id, title, price, description, mediaName]) => {
    const url = mediaName && mediaUrl(media.get(mediaName));
    return {
      external_id,
      title,
      price,
      description,
      ...(url ? { image: url } : {}),
    };
  });

  const existing = byName((await org.get('/feeds')).data);
  let created = 0;

  let feed = existing.get("Today's specials");
  if (!feed) {
    ({ data: feed } = await org.post('/feeds', {
      feed: {
        name: "Today's specials",
        description: 'Dishes of the day, sent by the point-of-sale system',
        mode: 'list',
        keep: 20,
        schema: {
          title: { type: 'string', required: true },
          price: { type: 'string', required: true },
          description: 'string',
          image: 'url',
        },
        media_fields: [{ path: 'image', mode: 'link' }],
      },
    }));
    created++;
  }

  const { data: tokens } = await org.get(`/feeds/${feed.id}/tokens`);
  if (
    !tokens.some(
      (token) => token.name === 'POS integration' && !token.revoked_at
    )
  ) {
    const { secret } = await org.post(`/feeds/${feed.id}/tokens`, {
      name: 'POS integration',
    });
    // Send the entries as the point-of-sale system would.
    const response = await fetch(`${API_URL}/api/v1/feeds/${feed.id}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries: specials }),
    });
    if (!response.ok)
      throw new Error(`Feed API write failed with HTTP ${response.status}`);
  }
  const { data } = await org.get(`/feeds/${feed.id}/entries`);
  const present = new Set(
    (data.entries ?? []).map((entry) => entry.external_id)
  );
  for (const entry of specials) {
    if (!present.has(entry.external_id)) {
      await org.post(`/feeds/${feed.id}/test-entry`, { entry });
    }
  }

  let hours = existing.get('Opening hours');
  if (!hours) {
    ({ data: hours } = await org.post('/feeds', {
      feed: {
        name: 'Opening hours',
        description:
          'Opening hours of all restaurants, updated by the head office',
        mode: 'document',
        keep: 1,
        media_fields: [],
      },
    }));
    created++;
  }
  const { data: hoursData } = await org.get(`/feeds/${hours.id}/entries`);
  if (!hoursData.document) {
    await org.post(`/feeds/${hours.id}/test-entry`, {
      document: {
        restaurants: [
          {
            name: 'Downtown',
            weekdays: '07:00–21:00',
            weekends: '09:00–22:00',
          },
          { name: 'Airport', weekdays: '05:30–22:00', weekends: '05:30–22:00' },
          {
            name: 'Harbor Front',
            weekdays: '11:00–22:00',
            weekends: '10:00–23:00',
          },
        ],
        note: 'The kitchen closes 30 minutes before closing time.',
      },
    });
  }

  summary(`${org.name} feeds`, [feed, hours], created);
  return new Map([
    [feed.name, feed],
    [hours.name, hours],
  ]);
}

async function seedAutomations(org, { playlists, channels, devices }) {
  const clock = (config) => ({
    source: 'clock',
    condition: 'at',
    config: { ...config, timezone: TIMEZONE },
  });
  const interrupt = (playlist, config = {}) => ({
    action: 'interrupt',
    config: {
      playlist_id: playlists.get(playlist).id,
      start: 'after_current_item',
      max_wait_seconds: 120,
      plays: 1,
      priority: 'normal',
      ...config,
    },
  });
  const specs = [
    {
      name: 'Happy hour on Fridays',
      rules: [
        {
          when: clock({
            schedule: { type: 'times', times: ['15:00'] },
            weekdays: [5],
          }),
          then: interrupt('Happy hour', { plays: 2 }),
          cooldown_seconds: 0,
        },
      ],
      channels: ['Downtown'],
      devices: [],
    },
    {
      name: 'Hourly hiring reminder',
      rules: [
        {
          when: clock({
            schedule: { type: 'hourly', minute: 30 },
            weekdays: WEEKDAYS,
            window: { start: '09:00', end: '18:00' },
          }),
          then: interrupt('Lobby welcome'),
          cooldown_seconds: 600,
        },
      ],
      channels: [],
      devices: ['Downtown – Window', 'Airport – Gate 12'],
    },
  ];

  const existing = byName(await org.list('automations'));
  const result = new Map();
  let created = 0;
  for (const spec of specs) {
    let automation = existing.get(spec.name);
    if (!automation) {
      ({ data: automation } = await org.post('/automations', {
        automation: { name: spec.name, enabled: true, rules: spec.rules },
      }));
      created++;
    }
    const wantedDevices = spec.devices.map((name) => devices.get(name).id);
    const wantedChannels = spec.channels.map((name) => channels.get(name).id);
    if (
      !entriesMatch(
        (automation.devices ?? []).map((d) => d.id),
        wantedDevices
      ) ||
      !entriesMatch(
        (automation.channels ?? []).map((c) => String(c.id)),
        wantedChannels.map(String)
      )
    ) {
      await org.put(`/automations/${automation.id}/assignments`, {
        devices: wantedDevices,
        channels: wantedChannels,
      });
    }
    result.set(spec.name, automation);
  }
  summary(`${org.name} automations`, specs, created);
  return result;
}

/** A few MCP requests with the agent's secret, so its activity log has entries. */
async function useAgent(secret, playlists) {
  let id = 0;
  const call = async (method, params) => {
    const response = await fetch(`${API_URL}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    });
    if (!response.ok)
      throw new Error(`MCP ${method} failed with HTTP ${response.status}`);
    const body = await response.json();
    if (body.error)
      throw new Error(`MCP ${method} failed: ${body.error.message}`);
    return body.result;
  };

  await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'castmill-demo', version: '1.0.0' },
  });
  await call('tools/list', {});
  await call('tools/call', {
    name: 'list_resources',
    arguments: { resource_type: 'playlists' },
  });
  await call('tools/call', {
    name: 'list_resources',
    arguments: { resource_type: 'medias', search: 'Lunch' },
  });
  await call('tools/call', {
    name: 'get_resource',
    arguments: {
      resource_type: 'playlists',
      id: playlists.get('Lunch menu').id,
    },
  });
}

async function seedAgent(org, playlists) {
  const name = 'Menu assistant';
  const agents = byName((await org.get('/agents')).data);
  let agent = agents.get(name);
  let secret;
  let created = 0;
  if (!agent) {
    ({ data: agent, secret } = await org.post('/agents', {
      agent: {
        name,
        description:
          'Updates the lunch menu and the daily specials from the kitchen system',
        role: 'editor',
      },
    }));
    created++;
  } else {
    const { data: actions } = await org.get(
      `/agent-actions?agent_id=${agent.id}&page=1&page_size=1`
    );
    if (!actions.length) {
      ({ data: agent, secret } = await org.post(
        `/agents/${agent.id}/credentials`
      ));
    }
  }
  if (secret) await useAgent(secret, playlists);
  summary(`${org.name} agents`, [agent], created);
  return new Map([[name, agent]]);
}

// All onboarding steps (Castmill.Accounts.OnboardingProgress), so the
// getting-started tour neither opens nor shows open steps.
const ONBOARDING_STEPS = [
  'find_guide',
  'choose_language',
  'upload_media',
  'create_playlist',
  'create_channel',
  'register_device',
  'assign_channel',
  'advanced_playlist',
  'create_tag_group',
  'tag_content',
  'explore_tree_view',
];

async function completeOnboarding() {
  for (const [key, userId] of Object.entries(demo.users)) {
    const http = client(demo.tokens[key]);
    const url = `/dashboard/users/${userId}/onboarding-progress`;
    const { data } = await http.get(url);
    if (data.dismissed && data.is_completed) continue;
    await http.put(url, {
      completed_steps: ONBOARDING_STEPS,
      is_completed: true,
      dismissed: true,
    });
  }
  log('Onboarding: completed and dismissed for all demo users');
}

// ---------------------------------------------------------------------------
// Other organizations
// ---------------------------------------------------------------------------

async function seedOtherOrganizations(files) {
  const result = {};

  const northwind = organization('Northwind Retail', 'maria');
  const nwWidgets = await widgetsBySlug(northwind);
  const nwMedia = await ensureMedia(
    northwind,
    [
      ['Spring collection', 'weekend-brunch.jpg'],
      ['Store hours', 'free-wifi.png'],
      ['Loyalty program', 'coffee-of-the-month.jpg'],
    ],
    files
  );
  const nwPlaylists = await ensurePlaylists(northwind, nwWidgets, [
    {
      name: 'Spring campaign',
      aspectRatio: '16:9',
      items: [
        image(nwMedia.get('Spring collection'), 10),
        image(nwMedia.get('Loyalty program'), 8),
      ],
    },
    {
      name: 'Store information',
      aspectRatio: '16:9',
      items: [
        image(nwMedia.get('Store hours'), 10),
        qrCode('https://northwind.example/stores', 'Find your nearest store'),
      ],
    },
  ]);
  const nwChannels = await ensureChannels(
    northwind,
    [
      {
        name: 'Oslo flagship',
        timezone: 'Europe/Oslo',
        defaultPlaylist: 'Spring campaign',
      },
    ],
    nwPlaylists
  );
  result['Northwind Retail'] = {
    media: ids(nwMedia),
    playlists: ids(nwPlaylists),
    channels: ids(nwChannels),
  };

  const riverside = organization('Riverside Library', 'omar');
  const rlPlaylists = await ensurePlaylists(
    riverside,
    await widgetsBySlug(riverside),
    [
      {
        name: 'Events this week',
        aspectRatio: '16:9',
        items: [
          qrCode(
            'https://riverside-library.example/events',
            "This week's events"
          ),
        ],
      },
    ]
  );
  const rlChannels = await ensureChannels(
    riverside,
    [
      {
        name: 'Main hall',
        timezone: 'Europe/Copenhagen',
        defaultPlaylist: 'Events this week',
      },
    ],
    rlPlaylists
  );
  result['Riverside Library'] = {
    playlists: ids(rlPlaylists),
    channels: ids(rlChannels),
  };

  const summit = organization('Summit Fitness', 'emma');
  const sfPlaylists = await ensurePlaylists(
    summit,
    await widgetsBySlug(summit),
    [
      {
        name: 'Class schedule',
        aspectRatio: '16:9',
        items: [
          qrCode(
            'https://summit-fitness.example/classes',
            'Book your next class'
          ),
        ],
      },
    ]
  );
  result['Summit Fitness'] = { playlists: ids(sfPlaylists) };

  return result;
}

// A widget the network administrator uploads for some organizations (Widget Access).
const NETWORK_WIDGET = {
  name: 'Welcome banner',
  slug: 'welcome-banner',
  description: 'A full-screen welcome message in the colours of the restaurant',
  template: {
    type: 'group',
    name: 'root',
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      background: '#12324a',
    },
    components: [
      {
        type: 'text',
        name: 'message',
        opts: { text: { key: 'options.message' }, autofit: { maxSize: 8 } },
        style: { color: '#ffffff', 'font-weight': '700', padding: '0 1em' },
      },
    ],
  },
  options_schema: {
    message: {
      type: 'string',
      default: 'Welcome',
      description: 'The text to show',
    },
  },
};

async function seedNetworkWidget() {
  const http = client(demo.tokens.alex);
  const { data } = await http.get(
    '/dashboard/network/widgets?page=1&page_size=100'
  );
  let widget = data.find(({ slug }) => slug === NETWORK_WIDGET.slug);
  if (!widget) {
    const body = new FormData();
    body.append(
      'widget',
      new Blob([JSON.stringify(NETWORK_WIDGET)], { type: 'application/json' }),
      'widget.json'
    );
    const response = await fetch(`${API_URL}/dashboard/network/widgets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${demo.tokens.alex}`, Origin: ORIGIN },
      body,
    });
    if (!response.ok)
      throw new Error(`Uploading the network widget: ${response.status}`);
    widget = (await response.json()).data;
    await http.put(`/dashboard/network/widgets/${widget.id}/access`, {
      access: 'selected',
    });
    await http.patch(`/dashboard/network/widgets/${widget.id}/organizations`, {
      enable: [
        demo.organizations['Harbor Kitchen'],
        demo.organizations['Northwind Retail'],
      ],
    });
  }
  return widget.id;
}

// Keeps the newest notification of each type unread, so the notification panel
// shows a few unread ones and the bell's badge stays small.
async function settleNotifications() {
  const http = client(demo.tokens.alex);
  const { data } = await http.get(
    '/dashboard/notifications?page=1&page_size=100'
  );
  const newest = [...data].sort((a, b) =>
    b.inserted_at.localeCompare(a.inserted_at)
  );
  const kept = new Set();
  for (const notification of newest) {
    if (!kept.has(notification.type)) {
      kept.add(notification.type);
    } else if (!notification.read) {
      await http.patch(`/dashboard/notifications/${notification.id}/read`);
    }
  }
}

async function reportNotifications() {
  await settleNotifications();
  const { data, unread_count: unread } = await client(demo.tokens.alex).get(
    '/dashboard/notifications?page=1&page_size=100'
  );
  const types = {};
  for (const { type } of data) types[type] = (types[type] ?? 0) + 1;
  const list = Object.entries(types).map(([type, count]) => `${type} ${count}`);
  log(
    `Alex's notifications: ${data.length} (${unread} unread)${list.length ? `: ${list.join(', ')}` : ''}`
  );
}

// ---------------------------------------------------------------------------

async function main() {
  const files = await generateMedia(MEDIA_DIR);
  const hk = organization('Harbor Kitchen', 'alex');
  const widgets = await widgetsBySlug(hk);

  const media = await ensureMedia(hk, HK_MEDIA, files);
  const { groups, tags } = await seedTags(hk);
  const layouts = await seedLayouts(hk);
  const playlists = await seedHarborPlaylists(hk, widgets, media, layouts);
  const channels = await seedHarborChannels(hk, playlists);
  const devices = await seedDevices(hk, channels);
  await seedTagging(hk, tags, { media, playlists, channels, devices });
  const teams = await seedTeams(hk, { media, playlists, channels, devices });
  await seedOrganizationInvitation(hk, 'lena.berg@example.com', 'member');
  await seedNetworkInvitation(
    hk.http,
    'Summit Fitness',
    'oliver.grant@example.com',
    'admin'
  );
  const feeds = await seedFeeds(hk, media);
  const automations = await seedAutomations(hk, {
    playlists,
    channels,
    devices,
  });
  const agents = await seedAgent(hk, playlists);
  await completeOnboarding();
  const others = await seedOtherOrganizations(files);
  const networkWidget = await seedNetworkWidget();
  await reportNotifications();

  const latest = JSON.parse(readFileSync(DEMO_FILE, 'utf8'));
  latest.seed = {
    'Harbor Kitchen': {
      media: ids(media),
      tagGroups: ids(groups),
      tags: ids(tags),
      layouts: ids(layouts),
      playlists: ids(playlists),
      channels: ids(channels),
      devices: ids(devices),
      teams: ids(teams),
      feeds: ids(feeds),
      automations: ids(automations),
      agents: ids(agents),
    },
    ...others,
    network: { widgets: { [NETWORK_WIDGET.name]: networkWidget } },
  };
  writeFileSync(DEMO_FILE, JSON.stringify(latest, null, 2), { mode: 0o600 });
  log(`Wrote the seed ids to ${path.relative(process.cwd(), DEMO_FILE)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
