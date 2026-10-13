import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config();

const { signedVariants } = await import('../utils/signedImage.js');

/**
 * Security regression test: a client must not be able to obtain a
 * larger or cleaner rendition than the interface served it.
 *
 * This one talks to Cloudinary on purpose. The unit tests in
 * signedImage.test.js prove the application *generates* signatures bound
 * to each transformation; only a real request proves the account
 * *enforces* them. Those are two separate halves of the fix and the first
 * is worthless alone — a signed URL that Cloudinary does not check is
 * just a longer URL.
 *
 * If this fails with every variant returning 200, the code is almost
 * certainly fine and the account setting is off. Turn on:
 *
 *     Cloudinary console → Settings → Security → Strict transformations
 *
 * Run with: npm run test:security --prefix server
 */

// A real public id is required; the id below is overridden by
// TEST_PUBLIC_ID so this does not rot when the seed data changes.
const PUBLIC_ID =
  process.env.TEST_PUBLIC_ID || 'the_print_labs/products/bqmdypgd2eqgcki9psyy';

const status = async (url) => (await fetch(url, { method: 'GET' })).status;

test('the signed derivative the UI uses is served', async () => {
  const { w400 } = signedVariants(PUBLIC_ID);
  assert.equal(await status(w400), 200, 'the legitimate signed URL must work');
});

test('widening the transformation is rejected', async () => {
  const { w400 } = signedVariants(PUBLIC_ID);
  // The attack: keep the signature, ask for five times the pixels.
  const escalated = w400.replace('w_400', 'w_2000');

  assert.notEqual(
    await status(escalated),
    200,
    'w_400 was editable to w_2000 — signatures are generated but not ' +
      'enforced. Enable Strict transformations in the Cloudinary console ' +
      '(Settings → Security).'
  );
});

test('raising the quality is rejected', async () => {
  const { w400 } = signedVariants(PUBLIC_ID);
  const escalated = w400.replace('q_auto:eco', 'q_auto:best');

  assert.notEqual(
    await status(escalated),
    200,
    'the quality parameter was editable — see the note above'
  );
});

test('a forged signature is rejected', async () => {
  const { w400 } = signedVariants(PUBLIC_ID);
  const forged = w400.replace(/\/s--[^/]*--\//, '/s--AAAAAAAA--/');

  assert.notEqual(await status(forged), 200, 'a wrong signature must not be served');
});
