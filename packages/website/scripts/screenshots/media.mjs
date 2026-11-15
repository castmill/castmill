// Generates the fictional "Harbor Kitchen" media used by the screenshot demo:
// signage slides rendered from SVG and a short video made from them. Nothing is
// downloaded, so the demo has no third-party content.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FONT = "Avenir Next, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const C = {
  navy: '#12324a',
  deep: '#0c2233',
  teal: '#1f7a8c',
  sand: '#f4e9d8',
  cream: '#fbf6ee',
  coral: '#e86f51',
  mustard: '#f2b134',
  ink: '#10202e',
  brown: '#3b2418',
};

const text = (
  x,
  y,
  size,
  fill,
  content,
  { weight = 400, anchor = 'start', spacing = 0 } = {}
) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${content}</text>`;

const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

// A ship's anchor, drawn in a 100x100 box centred on the origin.
const anchor = (stroke, width) =>
  `<g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">
     <circle cy="-36" r="10"/><path d="M0 -26 V42 M-22 -10 H22"/>
     <path d="M-38 14 Q-34 42 0 42 Q34 42 38 14"/><path d="M-46 22 L-38 12 L-28 20 M46 22 L38 12 L28 20"/>
   </g>`;

const brand = (x, y, fill) =>
  `<g transform="translate(${x} ${y}) scale(0.42)">${anchor(fill, 10)}</g>` +
  text(x + 44, y + 10, 30, fill, 'HARBOR KITCHEN', { weight: 600, spacing: 4 });

const bowl = (cx, cy, r, color, food) => `
  <ellipse cx="${cx}" cy="${cy + r * 0.62}" rx="${r * 1.05}" ry="${r * 0.16}" fill="#000" opacity="0.18"/>
  <path d="M${cx - r} ${cy} A${r} ${r * 0.9} 0 0 0 ${cx + r} ${cy} Z" fill="${color}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.22}" fill="${food}"/>
  <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.02}" r="${r * 0.08}" fill="#fff" opacity="0.7"/>
  <circle cx="${cx + r * 0.2}" cy="${cy + r * 0.04}" r="${r * 0.06}" fill="#2f6b3a"/>
  <circle cx="${cx + r * 0.45}" cy="${cy - r * 0.03}" r="${r * 0.05}" fill="#2f6b3a"/>`;

const steam = (cx, cy, color) =>
  [-60, 0, 60]
    .map(
      (dx) =>
        `<path d="M${cx + dx} ${cy} q-24 -40 0 -80 t0 -80" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.55"/>`
    )
    .join('');

const menu = (x, y, items, color, accent) =>
  items
    .map(
      ([name, detail, price], i) =>
        text(x, y + i * 150, 52, color, name, { weight: 600 }) +
        text(x, y + i * 150 + 50, 32, color, detail) +
        text(x + 740, y + i * 150, 52, accent, price, {
          weight: 600,
          anchor: 'end',
        })
    )
    .join('');

const slides = {
  'lunch-specials.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.navy}"/>
     <circle cx="1720" cy="980" r="420" fill="${C.teal}" opacity="0.35"/>
     ${brand(140, 140, C.sand)}
     ${text(140, 360, 128, '#fff', 'Lunch specials', { weight: 700 })}
     ${text(140, 440, 44, C.mustard, 'Monday to Friday, 11:30–14:00')}
     ${bowl(520, 760, 230, C.coral, C.mustard)}
     ${menu(
       1100,
       600,
       [
         ['Roasted tomato soup', 'Sourdough and whipped butter', '95 kr'],
         ['Baked salmon', 'Dill potatoes, lemon cream', '145 kr'],
         ['Halloumi grain bowl', 'Roasted roots, tahini, herbs', '125 kr'],
       ],
       '#fff',
       C.mustard
     )}`
  ),
  'happy-hour.jpg': svg(
    1920,
    1080,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.coral}"/><stop offset="1" stop-color="${C.mustard}"/></linearGradient></defs>
     <rect width="1920" height="1080" fill="url(#g)"/>
     ${brand(140, 140, C.ink)}
     ${text(140, 470, 200, C.ink, 'Happy hour', { weight: 700 })}
     ${text(140, 570, 56, C.ink, 'Every weekday, 15:00–17:00')}
     ${text(140, 660, 44, C.ink, 'Half price on house drinks and small plates')}
     <g transform="translate(1480 300)">
       <path d="M-150 0 H150 L20 190 V420 H110 V450 H-110 V420 H-20 V190 Z" fill="#fff" opacity="0.9"/>
       <path d="M-110 30 H110 L0 170 Z" fill="${C.coral}"/>
       <circle cx="70" cy="-30" r="44" fill="#7cc36b"/>
     </g>`
  ),
  'seasonal-soup.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.sand}"/>
     <circle cx="1350" cy="560" r="400" fill="${C.cream}"/>
     ${steam(1350, 420, C.coral)}
     ${bowl(1350, 640, 330, C.navy, '#e9853f')}
     ${brand(140, 140, C.navy)}
     ${text(140, 420, 44, C.coral, 'SOUP OF THE WEEK', { weight: 600, spacing: 6 })}
     ${text(140, 540, 108, C.navy, 'Roasted pumpkin', { weight: 700 })}
     ${text(140, 660, 108, C.navy, 'and ginger', { weight: 700 })}
     ${text(140, 780, 52, C.navy, 'With toasted seeds · 95 kr')}`
  ),
  'weekend-brunch.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.teal}"/>
     <rect x="1100" y="0" width="820" height="1080" fill="${C.navy}" opacity="0.35"/>
     ${brand(140, 140, C.cream)}
     ${text(140, 400, 128, '#fff', 'Weekend brunch', { weight: 700 })}
     ${text(140, 480, 48, C.sand, 'Saturday and Sunday, 10:00–14:00')}
     ${text(140, 640, 44, '#fff', 'Buttermilk pancakes · Shakshuka')}
     ${text(140, 710, 44, '#fff', 'Smoked salmon toast · Fresh juices')}
     ${text(140, 860, 56, C.mustard, '245 kr per person', { weight: 600 })}
     <g transform="translate(1510 560)">
       <circle r="270" fill="${C.cream}"/>
       <circle r="200" fill="#f7d9a6"/>
       <circle r="200" cy="-24" fill="#f3c47d"/>
       <circle r="200" cy="-48" fill="#eeb262"/>
       <path d="M-60 -150 Q0 -40 60 -150" fill="#8a4b1d"/>
       <rect x="-40" y="-190" width="80" height="44" rx="10" fill="#fff6dd"/>
     </g>`
  ),
  'cardamom-buns.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.mustard}"/>
     ${brand(140, 140, C.brown)}
     ${text(140, 440, 120, C.brown, 'Fresh cardamom buns', { weight: 700 })}
     ${text(140, 530, 52, C.brown, 'Baked every morning in our kitchen')}
     ${text(140, 680, 72, '#fff', '39 kr', { weight: 700 })}
     ${[0, 1, 2]
       .map(
         (
           i
         ) => `<g transform="translate(${1150 + i * 230} ${800 - (i % 2) * 120})">
           <circle r="140" fill="#b9733a"/>
           <path d="M0 0 m-100 0 a100 100 0 1 0 200 0 a80 80 0 1 0 -160 0 a60 60 0 1 0 120 0 a40 40 0 1 0 -80 0" stroke="#8a4b1d" stroke-width="16" fill="none"/>
           <circle r="140" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="4 26" opacity="0.6"/>
         </g>`
       )
       .join('')}`
  ),
  'now-hiring.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.cream}"/>
     <rect x="0" y="880" width="1920" height="200" fill="${C.navy}"/>
     ${brand(140, 140, C.navy)}
     ${text(140, 440, 140, C.navy, 'We are hiring', { weight: 700 })}
     ${text(140, 540, 56, C.teal, 'Line cooks, bakers and baristas')}
     ${text(140, 990, 44, C.cream, 'Ask our staff or apply at harborkitchen.example/jobs')}
     <g transform="translate(1490 470)" fill="#ffffff" stroke="${C.navy}" stroke-width="14">
       <circle cx="-130" cy="-60" r="120"/><circle cx="130" cy="-60" r="120"/><circle cy="-140" r="150"/>
       <path d="M-170 0 V200 H170 V0" stroke-linejoin="round"/>
       <path d="M-170 140 H170" fill="none"/>
     </g>`
  ),
  'free-wifi.png': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${C.deep}"/>
     ${brand(140, 140, C.sand)}
     <g transform="translate(1440 640)" fill="none" stroke="${C.mustard}" stroke-width="40" stroke-linecap="round">
       <path d="M-300 -150 A420 420 0 0 1 300 -150"/>
       <path d="M-200 -40 A280 280 0 0 1 200 -40"/>
       <path d="M-100 70 A140 140 0 0 1 100 70"/>
       <circle cy="160" r="30" fill="${C.mustard}" stroke="none"/>
     </g>
     ${text(140, 480, 140, '#fff', 'Free Wi-Fi', { weight: 700 })}
     ${text(140, 590, 56, C.sand, 'Network: HarborGuest')}
     ${text(140, 670, 56, C.sand, 'No password needed')}`
  ),
  'allergen-info.jpg': svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="#ffffff"/>
     <rect x="80" y="80" width="1760" height="920" rx="40" fill="none" stroke="${C.teal}" stroke-width="8"/>
     ${brand(180, 200, C.teal)}
     ${text(180, 470, 120, C.ink, 'Allergies or intolerances?', { weight: 700 })}
     ${text(180, 580, 52, C.ink, 'Ask us about the ingredients in every dish.')}
     ${text(180, 660, 52, C.ink, 'Gluten-free and vegan options are marked on the menu.')}`
  ),
  'harbor-kitchen-logo.png': svg(
    512,
    512,
    `<rect width="512" height="512" rx="96" fill="${C.navy}"/>
     <g transform="translate(256 200) scale(2)">${anchor(C.mustard, 9)}</g>
     ${text(256, 372, 54, C.sand, 'HARBOR', { weight: 700, anchor: 'middle', spacing: 8 })}
     ${text(256, 430, 40, C.sand, 'KITCHEN', { weight: 500, anchor: 'middle', spacing: 10 })}`
  ),
  'coffee-of-the-month.jpg': svg(
    1080,
    1920,
    `<rect width="1080" height="1920" fill="${C.brown}"/>
     <circle cx="540" cy="760" r="380" fill="#5a3826"/>
     ${steam(540, 560, C.sand)}
     <g transform="translate(540 820)">
       <path d="M-230 -120 H230 L190 200 Q180 260 120 260 H-120 Q-180 260 -190 200 Z" fill="${C.cream}"/>
       <path d="M230 -60 Q330 -60 320 40 Q310 130 210 120" stroke="${C.cream}" stroke-width="36" fill="none"/>
       <ellipse rx="230" ry="44" cy="-120" fill="#6b3f22"/>
     </g>
     ${text(540, 1340, 44, C.mustard, 'COFFEE OF THE MONTH', { weight: 600, anchor: 'middle', spacing: 6 })}
     ${text(540, 1460, 96, '#fff', 'Ethiopia', { weight: 700, anchor: 'middle' })}
     ${text(540, 1560, 60, C.sand, 'Yirgacheffe, washed', { anchor: 'middle' })}
     ${text(540, 1700, 48, C.sand, 'Notes of jasmine and lemon', { anchor: 'middle' })}`
  ),
};

const VIDEO_SLIDES = [
  'lunch-specials.jpg',
  'seasonal-soup.jpg',
  'weekend-brunch.jpg',
  'cardamom-buns.jpg',
];

async function renderSlide(dir, name) {
  const file = path.join(dir, name);
  if (existsSync(file)) return file;
  const image = sharp(Buffer.from(slides[name]));
  await (
    name.endsWith('.png') ? image.png() : image.jpeg({ quality: 88 })
  ).toFile(file);
  return file;
}

// A 12-second 1280x720 clip: each slide zooms in slowly, with crossfades.
function renderVideo(dir, inputs) {
  const file = path.join(dir, 'kitchen-highlights.mp4');
  if (existsSync(file)) return file;
  const seconds = 3.5;
  const fade = 0.5;
  const args = ['-y', '-loglevel', 'error'];
  // One frame per image: zoompan turns it into `frames` frames.
  for (const input of inputs) args.push('-i', input);
  const frames = Math.round(seconds * 30);
  const zoom = inputs
    .map(
      (_, i) =>
        `[${i}:v]scale=2560:1440,zoompan=z='1+0.0008*on':d=${frames}:s=1280x720:fps=30,setsar=1[z${i}]`
    )
    .join(';');
  let last = 'z0';
  const fades = inputs
    .slice(1)
    .map((_, i) => {
      const out = `x${i + 1}`;
      const step = `[${last}][z${i + 1}]xfade=transition=fade:duration=${fade}:offset=${((i + 1) * (seconds - fade)).toFixed(2)}[${out}]`;
      last = out;
      return step;
    })
    .join(';');
  args.push(
    '-filter_complex',
    `${zoom};${fades}`,
    '-map',
    `[${last}]`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    file
  );
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  return file;
}

/** Writes the demo media to `dir` (once) and returns their file paths by name. */
export async function generateMedia(dir) {
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const name of Object.keys(slides))
    files[name] = await renderSlide(dir, name);
  files['kitchen-highlights.mp4'] = renderVideo(
    dir,
    VIDEO_SLIDES.map((name) => files[name])
  );
  return files;
}
