/**
 * Simple development server that serves a built IPK so it can be installed on
 * an LG display through SCAP's application update. Usage:
 *
 *   node server.js [build|latest|tpd|test]
 *
 * Set PORT to change the default port (3232).
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(here, 'public/appinfo.json'), 'utf8')
);
const versionedIpk = `com.lg.app.signage_${version}_all.ipk`;

const SOURCES = {
  build: { file: versionedIpk, root: join(here, 'build') },
  latest: { file: 'player.ipk', root: join(here, 'releases/latest') },
  tpd: { file: versionedIpk, root: join(here, 'releases/tpd') },
  test: { file: versionedIpk, root: join(here, 'releases/test') },
};

const name = (process.argv[2] || 'build').toLowerCase();
const source = SOURCES[name];
if (!source) {
  console.error(
    `Unknown source "${name}". Use one of: ${Object.keys(SOURCES).join(', ')}`
  );
  process.exit(1);
}

const ipkPath = join(source.root, source.file);
if (!existsSync(ipkPath)) {
  console.warn(
    `Warning: ${ipkPath} does not exist yet. Run "yarn build && yarn package".`
  );
}

const port = Number(process.env.PORT) || 3232;
const distRoot = resolve(here, 'dist');
const IPK_ROUTE = '/application/com.lg.app.signage.ipk';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ipk': 'application/octet-stream',
};

function sendFile(req, res, path, contentType) {
  let size;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error('Not a file');
    size = stat.size;
  } catch {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type':
      contentType || MIME_TYPES[extname(path)] || 'application/octet-stream',
    'Content-Length': size,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(path).pipe(res);
}

// Resolves a request path inside dist, rejecting traversal outside it.
function distPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const path = resolve(distRoot, `.${decoded}`);
  if (path !== distRoot && !path.startsWith(distRoot + sep)) return undefined;
  return path === distRoot || decoded.endsWith('/')
    ? join(path, 'index.html')
    : path;
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  console.log('Request', pathname);
  res.on('finish', () => console.log('Finished', pathname));

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  if (pathname === IPK_ROUTE) {
    console.log(`Sending ${ipkPath}`);
    sendFile(req, res, ipkPath, 'application/octet-stream');
    return;
  }
  const path = distPath(pathname);
  if (!path) {
    res.writeHead(404).end('Not found');
    return;
  }
  sendFile(req, res, path);
});

server.listen(port, () => {
  console.log(`Serving ${ipkPath}`);
  console.log(`IPK URL: http://<this-machine-ip>:${port}${IPK_ROUTE}`);
});
