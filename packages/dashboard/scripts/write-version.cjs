const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const distPath = path.join(__dirname, '..', 'dist');
const versionFilePath = path.join(distPath, 'version.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionInfo = {
  app: packageJson.name,
  version: packageJson.version,
  build: {
    castmill_git_sha:
      process.env.VITE_CASTMILL_GIT_SHA ||
      process.env.CASTMILL_GIT_SHA ||
      'unknown',
    built_at:
      process.env.VITE_BUILD_TIME ||
      process.env.CASTMILL_BUILD_TIME ||
      new Date().toISOString(),
  },
  runtime: {
    api_url: process.env.VITE_API_URL || null,
    ws_endpoint: process.env.VITE_WS_ENDPOINT || null,
  },
};

fs.mkdirSync(distPath, { recursive: true });
fs.writeFileSync(versionFilePath, `${JSON.stringify(versionInfo, null, 2)}\n`);

console.log(`Wrote ${path.relative(process.cwd(), versionFilePath)}`);