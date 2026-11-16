const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { promisify } = require('node:util');

const releaseRequire = createRequire(require.resolve('semantic-release'));

test('semantic-release and its default plugins load', () => {
  assert.equal(typeof require('semantic-release'), 'function');
  for (const plugin of [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
  ]) {
    assert.ok(releaseRequire(plugin));
  }
});

test('release temporary directories are cleaned up after use', async () => {
  const tempy = releaseRequire('tempy');
  let directory;
  await tempy.directory.task(async (temporaryDirectory) => {
    directory = temporaryDirectory;
    fs.writeFileSync(path.join(directory, 'release.txt'), 'release');
    assert.ok(fs.existsSync(directory));
  });
  assert.equal(fs.existsSync(directory), false);
});

test('release cleanup retains callback-compatible glob support', async (t) => {
  const tempyRequire = createRequire(releaseRequire.resolve('tempy'));
  const delRequire = createRequire(tempyRequire.resolve('del'));
  const rimraf = delRequire('rimraf');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castmill-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'release.txt'), 'release');
  fs.writeFileSync(path.join(directory, 'keep.log'), 'keep');

  await promisify(rimraf)(path.join(directory, '*.txt'));

  assert.deepEqual(fs.readdirSync(directory), ['keep.log']);
});
