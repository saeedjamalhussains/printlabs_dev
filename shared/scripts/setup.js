import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const envExamplePaths = [
  'apps/server/.env.example',
  'apps/store/.env.example',
  'apps/admin/.env.example',
  'apps/assistant/.env.example',
];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function setupEnvFiles(root = repositoryRoot, log = console.log) {
  const results = [];
  for (const relativePath of envExamplePaths) {
    const source = path.join(root, relativePath);
    const destination = source.slice(0, -'.example'.length);
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
      results.push({ path: relativePath.slice(0, -'.example'.length), created: true });
      log(`Created ${relativePath.slice(0, -'.example'.length)}`);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      results.push({ path: relativePath.slice(0, -'.example'.length), created: false });
      log(`Kept existing ${relativePath.slice(0, -'.example'.length)}`);
    }
  }
  return results;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  setupEnvFiles().catch((error) => {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
