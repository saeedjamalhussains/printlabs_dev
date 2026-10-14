import cloudinary from '../config/cloudinary.js';

/**
 * Signed, size-specific delivery URLs for a product image.
 *
 * ── The problem this solves ───────────────────────────────────────────
 * A plain Cloudinary delivery URL is a public API. The transformation
 * lives in the path, so anyone who can see
 *
 *     /image/upload/w_400,c_limit,f_auto/<public_id>.webp
 *
 * can edit it to w_2000, or strip the transform entirely, and fetch a
 * different rendition than the interface chose. Nothing the browser does
 * can prevent that, because the browser is the thing being asked.
 *
 * Signing moves the decision to the server. Each URL carries an `s--…--`
 * signature computed from the transformation string and the account
 * secret; change any character of the transform and the signature no
 * longer matches, and Cloudinary refuses the request.
 *
 * ── The setting that makes it bite ───────────────────────────────────
 * Signing alone is not enough. By default Cloudinary still serves
 * *unsigned* URLs happily, so a signed URL is merely one that also
 * works. The enforcement is an account-level switch:
 *
 *     Cloudinary console → Settings → Security → Strict transformations
 *
 * With that enabled, only signed (or explicitly allow-listed) derived
 * URLs are delivered and everything else returns 401 — at which point
 * editing w_400 to w_2000 stops working. That switch has to be thrown in
 * the console; it cannot be set from application code.
 *
 * ── What this is and is not ──────────────────────────────────────────
 * This stops someone escalating to a *larger or cleaner* rendition than
 * the page displays. It does not, and cannot, stop them keeping the
 * bytes they were legitimately sent — whatever is on screen has already
 * been decoded in their browser, and a screenshot is always available.
 * The value here is that the ceiling becomes the 400px derivative the
 * grid shows rather than whatever the URL can be talked into returning.
 */

/** Widths worth offering — mirrors WIDTH_LADDER in the client. */
const LADDER = [160, 240, 320, 400];

const variant = (publicId, transformation) =>
  cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    // The version is part of what is signed and keeps the URL immutable,
    // so these stay cacheable forever rather than changing per request —
    // a signature that varied per response would defeat browser and CDN
    // caching entirely.
    transformation,
  });

/**
 * @param {string} publicId Cloudinary public id stored on the product.
 * @returns {object|null}   Signed URLs keyed by width, plus `lqip`, or
 *                          null when there is no id to sign.
 */
export const signedVariants = (publicId) => {
  if (!publicId) return null;

  const out = {
    // The tiny blurred preview. Signed like everything else, so it
    // cannot be edited into a full-size fetch either.
    lqip: variant(publicId, [
      { width: 24, crop: 'limit', effect: 'blur:600', quality: 'auto:low', fetch_format: 'auto' },
    ]),
  };

  for (const width of LADDER) {
    out[`w${width}`] = variant(publicId, [
      { width, crop: 'limit', fetch_format: 'auto', quality: 'auto:eco' },
    ]);
  }

  // The stored rendition, which is already only 800px at q20 — see
  // features/images/uploadPresets.js. Signed and offered as the top rung
  // because re-encoding at that size costs more bytes than it saves.
  out.full = variant(publicId, []);

  return out;
};

export default signedVariants;
