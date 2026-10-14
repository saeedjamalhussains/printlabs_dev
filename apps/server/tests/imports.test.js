import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv.js';

const { default: app } = await import('../app.js');

test('API imports without connecting to external services', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});
