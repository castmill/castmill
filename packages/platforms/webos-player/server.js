/**
 * Simple development server that serves a built IPK so it can be installed on
 * an LG display through SCAP's application update. Usage:
 *
 *   node server.js [build|latest|tpd|test]
 *
 * Set PORT to change the default port (3232).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import onFinished from 'on-finished';

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
const app = express();

app.use((req, res, next) => {
  console.log('Request', req.originalUrl);
  onFinished(res, () => console.log('Finished', req.originalUrl));
  next();
});

app.use('/application/com.lg.app.signage.ipk', (req, res) => {
  console.log(`Sending ${ipkPath}`);
  res.contentType('application/octet-stream');
  res.sendFile(source.file, { root: source.root });
});

app.use('/', express.static(join(here, 'dist')));

app.listen(port, () => {
  console.log(`Serving ${ipkPath}`);
  console.log(
    `IPK URL: http://<this-machine-ip>:${port}/application/com.lg.app.signage.ipk`
  );
});
