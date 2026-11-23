const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

// The release workflow runs `npx semantic-release` from the repository root,
// which uses the hoisted semantic-release (an ES module since v20).
const releaseRequire = createRequire(
  require.resolve('semantic-release/package.json')
);

const load = (file) => import(pathToFileURL(file).href);

test('semantic-release loads', async () => {
  const semanticRelease = await load(require.resolve('semantic-release'));
  assert.equal(typeof semanticRelease.default, 'function');
});

test('the default release plugins load', async () => {
  const plugins = {
    '@semantic-release/commit-analyzer': 'analyzeCommits',
    '@semantic-release/release-notes-generator': 'generateNotes',
    '@semantic-release/npm': 'verifyConditions',
    '@semantic-release/github': 'verifyConditions',
  };
  for (const [plugin, step] of Object.entries(plugins)) {
    const mod = await load(releaseRequire.resolve(plugin));
    assert.equal(typeof mod[step], 'function', `${plugin} ${step}`);
  }
});
