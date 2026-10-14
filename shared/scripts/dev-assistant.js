import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assistantDirectory = path.join(repositoryRoot, 'apps', 'assistant');
const python = process.platform === 'win32'
  ? path.join(assistantDirectory, '.venv', 'Scripts', 'python.exe')
  : path.join(assistantDirectory, '.venv', 'bin', 'python');

try {
  await access(python);
} catch {
  console.error('Fabi environment is missing. Create apps/assistant/.venv and install apps/assistant/requirements.txt; see README.md.');
  process.exit(1);
}

const child = spawn(python, [
  '-m', 'uvicorn', 'app.main:app',
  '--host', '127.0.0.1',
  '--port', '8100',
], { cwd: assistantDirectory, stdio: 'inherit', env: process.env });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(`Could not start Fabi: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
