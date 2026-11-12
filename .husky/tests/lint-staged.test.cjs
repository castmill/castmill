const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const config = require(path.join(root, 'package.json'))['lint-staged'];
const lintStaged = path.join(
  root,
  'node_modules/lint-staged/bin/lint-staged.js'
);

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

function fixture(t) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'castmill-hook-test-'))
  );
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of [
    'packages/castmill',
    'packages/dashboard/src/i18n/locales',
    'bin',
  ]) {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ 'lint-staged': config })
  );
  fs.writeFileSync(
    path.join(dir, 'packages/castmill/a file.ex'),
    'defmodule A do\nend\n'
  );
  fs.writeFileSync(
    path.join(dir, 'packages/dashboard/src/i18n/locales/en.json'),
    '{}'
  );
  fs.writeFileSync(
    path.join(dir, 'bin/mix'),
    '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@" > "$TEST_MIX_LOG"\n[ "$1" = format ] && [ -f "$2" ] || exit 8\nexit "${TEST_MIX_EXIT:-0}"\n',
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(dir, 'bin/yarn'),
    '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@" > "$TEST_YARN_LOG"\n[ "$#" -eq 1 ] && [ "$1" = check-translations ] || exit 8\nexit "${TEST_YARN_EXIT:-0}"\n',
    { mode: 0o755 }
  );
  assert.equal(run('git', ['init', '-q'], { cwd: dir }).status, 0);
  assert.equal(run('git', ['add', '.'], { cwd: dir }).status, 0);
  const env = {
    ...process.env,
    PATH: path.join(dir, 'bin') + path.delimiter + process.env.PATH,
    TEST_MIX_LOG: path.join(dir, 'mix.log'),
    TEST_YARN_LOG: path.join(dir, 'yarn.log'),
  };
  return { dir, env };
}

test('lint-staged runs formatting and full translation checks in their packages', (t) => {
  const { dir, env } = fixture(t);
  const result = run(process.execPath, [lintStaged, '--no-stash'], {
    cwd: dir,
    env,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(
    fs.readFileSync(env.TEST_MIX_LOG, 'utf8').trim().split('\n'),
    [
      path.join(dir, 'packages/castmill'),
      'format',
      path.join(dir, 'packages/castmill/a file.ex'),
    ]
  );
  assert.deepEqual(
    fs.readFileSync(env.TEST_YARN_LOG, 'utf8').trim().split('\n'),
    [path.join(dir, 'packages/dashboard'), 'check-translations']
  );
});

for (const variable of ['TEST_MIX_EXIT', 'TEST_YARN_EXIT']) {
  test(`lint-staged fails when ${variable} fails`, (t) => {
    const { dir, env } = fixture(t);
    env[variable] = '9';
    const result = run(process.execPath, [lintStaged, '--no-stash'], {
      cwd: dir,
      env,
    });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
  });
}
