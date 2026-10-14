import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { envExamplePaths, setupEnvFiles } from './setup.js';

test('copies environment examples without overwriting existing env files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'printlabs-setup-'));
  try {
    for (const example of envExamplePaths) {
      const source = path.join(root, example);
      await mkdir(path.dirname(source), { recursive: true });
      await writeFile(source, `EXAMPLE_${path.basename(path.dirname(source)).toUpperCase()}=true\n`);
    }

    const existingPath = path.join(root, 'apps/server/.env');
    await writeFile(existingPath, 'JWT_SECRET=local-secret\n');
    const result = await setupEnvFiles(root, () => {});

    assert.equal(result.filter((entry) => entry.created).length, 3);
    assert.equal(result.filter((entry) => !entry.created).length, 1);
    assert.equal(await readFile(existingPath, 'utf8'), 'JWT_SECRET=local-secret\n');
    assert.equal(await readFile(path.join(root, 'apps/store/.env'), 'utf8'), 'EXAMPLE_STORE=true\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
