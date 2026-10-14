import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv.js';

const { signedVariants } = await import('../utils/signedImage.js');
const { withSignedImages } = await import('../utils/productImages.js');

const PUBLIC_ID = 'the_print_labs/products/test-asset';
const SIG = /\/s--[A-Za-z0-9_-]+--\//;

test('every variant carries a signature', () => {
  const v = signedVariants(PUBLIC_ID);
  for (const [name, url] of Object.entries(v)) {
    assert.match(url, SIG, `${name} should be signed`);
  }
});

test('signing is deterministic for identical inputs', () => {
  assert.deepEqual(signedVariants(PUBLIC_ID), signedVariants(PUBLIC_ID));
});

/* The core property: the signature must cover the transformation, not
   merely the asset. If it only authorised the public id, an attacker
   could keep the signature and swap w_400 for w_2000. */
const sigOf = (url) => url.match(/\/s--([A-Za-z0-9_-]+)--\//)[1];

test('changing the width changes the signature', () => {
  const v = signedVariants(PUBLIC_ID);
  assert.notEqual(sigOf(v.w160), sigOf(v.w400));
});

test('changing the quality changes the signature', async () => {
  const cloudinary = (await import('../config/cloudinary.js')).default;
  const eco = cloudinary.url(PUBLIC_ID, {
    secure: true, sign_url: true,
    transformation: [{ width: 400, crop: 'limit', fetch_format: 'auto', quality: 'auto:eco' }],
  });
  const best = cloudinary.url(PUBLIC_ID, {
    secure: true, sign_url: true,
    transformation: [{ width: 400, crop: 'limit', fetch_format: 'auto', quality: 'auto:best' }],
  });
  assert.notEqual(sigOf(eco), sigOf(best));
});

test('the untransformed rendition signs differently from any derivative', () => {
  const v = signedVariants(PUBLIC_ID);
  assert.notEqual(sigOf(v.full), sigOf(v.w400));
});

test('an image with no publicId cannot be signed', () => {
  assert.equal(signedVariants(undefined), null);
  assert.equal(signedVariants(''), null);
});

/* ── The serialiser boundary ─────────────────────────────────────────
   These guard the rule that no unsigned Cloudinary URL may reach a
   client, which is the property a future refactor is most likely to
   break by "helpfully" restoring a fallback. */

test('API responses expose only signed URLs', () => {
  const product = {
    _id: 'p1',
    title: 'Test',
    images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/raw.webp', publicId: PUBLIC_ID }],
  };
  const out = withSignedImages(product);

  assert.match(out.images[0].url, SIG, 'images[].url must be signed');
  assert.equal(out.images[0].url.includes('raw.webp'), false, 'raw stored URL must not survive');
  for (const [name, url] of Object.entries(out.images[0].variants)) {
    assert.match(url, SIG, `variant ${name} must be signed`);
  }
});

test('an unsignable image is dropped rather than passed through unsigned', () => {
  const raw = 'https://res.cloudinary.com/demo/image/upload/v1/raw.webp';
  const out = withSignedImages({ _id: 'p2', images: [{ url: raw }] });

  assert.equal(out.images.length, 0, 'must not emit an image it cannot sign');
  assert.equal(JSON.stringify(out).includes(raw), false, 'raw URL must not appear anywhere');
});

test('the public id is withheld from storefront responses', () => {
  const product = { _id: 'p3', images: [{ url: 'x', publicId: PUBLIC_ID }] };

  assert.equal(withSignedImages(product).images[0].publicId, undefined);
  // The admin dashboard needs it to delete individual images.
  assert.equal(
    withSignedImages(product, { includePublicId: true }).images[0].publicId,
    PUBLIC_ID
  );
});
