// Cloudinary URL-transformation engine.
//
// ── What the pipeline actually looks like ──────────────────────────────
// Uploads are transformed once, at upload time, by server/utils/
// imageQuality.js: the longest edge is capped at 800px, quality is
// dropped to 20 and the file is converted to WebP. The consequence worth
// holding on to is that **the stored asset is already the derivative** —
// there is no full-resolution master behind it to leak, and 800px is the
// most pixels that exist for any product.
//
// What was missing was the second half: every surface then requested that
// same 800px file. A 152px poster in the suggestion rail, a 200px card in
// the shop grid and the large image on the product page were all served
// byte-for-byte the same image, so a phone showing a grid of thumbnails
// downloaded several times the pixels it could display.
//
// These helpers ask Cloudinary for the size each component actually
// renders. Two rules govern every transform below:
//
//   1. Never request more than STORED_MAX_WIDTH. Above that Cloudinary
//      upscales, which costs bandwidth to invent detail that was thrown
//      away at upload.
//   2. Only ever transform *downward*. Measured against the real assets:
//
//        stored, untransformed ........ 15.1 KB
//        w_800,f_auto,q_auto .......... 40.9 KB   <- nearly 3x larger
//        w_800,f_auto,q_auto:eco ...... 33.3 KB
//        w_400,f_auto,q_auto:eco ...... 12.4 KB
//        w_160,f_auto,q_auto:eco ....... 3.3 KB
//
//      Asking for the size the file already is makes it bigger, because
//      q_auto re-encodes an image that was deliberately saved at q20 and
//      spends bytes preserving compression artefacts. So any rung at or
//      above the stored width is served as the stored URL, untouched, and
//      the downscaled rungs use q_auto:eco — cheaper than q_auto, and the
//      artefacts shrink along with the pixels.

/** The widest the stored asset can be — see apps/server/features/images/uploadPresets.js. */
const STORED_MAX_WIDTH = 800;

/**
 * The width above which transforming costs more than it saves.
 *
 * Measured against the real assets (stored file = 15.1 KB):
 *
 *   w_640,q_auto:eco ... 25.3 KB   <- worse than sending the original
 *   w_480,q_auto:eco ... 16.3 KB   <- still worse
 *   w_400,q_auto:eco ... 12.4 KB   <- finally a saving
 *   w_240,q_auto:eco .... 7.0 KB
 *   w_160,q_auto:eco .... 3.3 KB
 *
 * The reason the curve sits so low is that the upload pipeline already
 * crushed these to 800px at q20, so there is barely any fat left to
 * trim: a re-encode spends more bytes faithfully reproducing existing
 * compression artefacts than it saves by removing pixels. Above this
 * width the stored file is simply the smaller thing to send, so that is
 * what gets sent.
 *
 * If the upload preset is ever changed to keep higher-quality masters,
 * re-measure — this number is a property of that preset, not a constant.
 */
const BREAK_EVEN_WIDTH = 400;

/**
 * The rungs offered to the browser in a srcset.
 *
 * Derived from what the interface actually renders rather than from
 * device categories:
 *   152–208px  suggestion rail  (clamp(9.5rem, 22vw, 13rem))
 *   180–300px  shop grid card   (auto-fill, minmax(180px, 1fr))
 *   up to ~700px  product detail image
 * Doubled for high-density screens, then capped at the stored width.
 */
const WIDTH_LADDER = [160, 240, 320, 400];

const isCloudinary = (url) => typeof url === 'string' && url.includes('/upload/');

/** Insert a transform segment into a Cloudinary delivery URL. */
const withTransform = (url, transform) => {
  if (!url || !isCloudinary(url) || !transform) return url || '';
  return url.replace('/upload/', `/upload/${transform}/`);
};

/**
 * A width-limited variant, or the stored file when the requested width
 * is not actually smaller than what is stored — see rule 2 above.
 */
const atWidth = (url, width) => {
  if (width > BREAK_EVEN_WIDTH) return url;
  return withTransform(url, `w_${width},c_limit,f_auto,q_auto:eco`);
};

/* ── Back-compatible preset API ──────────────────────────────────────
   Existing callers pass a preset name. These now carry real widths
   instead of the empty strings they used to hold. f_auto lets Cloudinary
   serve AVIF to browsers that take it and WebP to the rest. */
const PRESETS = {
  thumb:  'w_160,c_limit,f_auto,q_auto:eco',
  card:   'w_400,c_limit,f_auto,q_auto:eco',
  cart:   'w_240,c_limit,f_auto,q_auto:eco',
  // Deliberately empty: the detail view wants the full stored image, and
  // the stored image *is* 800px. Re-requesting it at 800 would re-encode
  // it to nearly three times the size.
  detail: '',
  // A deliberately tiny, heavily blurred preview — see placeholder().
  blur:   'w_24,c_limit,e_blur:600,f_auto,q_auto:low',
  protect: '',
};

const DEFAULT_PRESET = 'card';

/**
 * Apply a quality preset to a Cloudinary delivery URL.
 *
 * Kept so existing call sites keep working. New code should prefer
 * posterSources(), which lets the browser pick the rung.
 *
 * @param {string} url     The Cloudinary secure_url stored on the product.
 * @param {string} preset  A key of PRESETS, or a raw transform string.
 * @returns {string}       Transformed URL, or the original if untransformable.
 */
export const degrade = (url, preset = DEFAULT_PRESET) => {
  if (!url || typeof url !== 'string') return '';
  const transform = preset in PRESETS ? PRESETS[preset] : preset;
  return transform ? withTransform(url, transform) : url;
};

/**
 * A placeholder small enough to be effectively free — roughly 300–600
 * bytes at 24px wide and blurred.
 *
 * It exists so the reserved box holds the shape and dominant colours of
 * the poster while the real file arrives, rather than a flat grey
 * rectangle. It is never the final representation: the component swaps
 * to the real image as soon as that decodes.
 */
export const placeholder = (url) => degrade(url, 'blur');

/**
 * Build the inputs for a responsive <img>.
 *
 * `sizes` must describe how wide the image will actually be laid out —
 * the browser uses it, together with the device pixel ratio, to choose a
 * rung *before* layout happens. Getting it wrong is the usual reason a
 * srcset silently does nothing.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} options.sizes    A CSS `sizes` descriptor.
 * @param {number} options.maxWidth Largest width this component ever
 *                                  renders at, in CSS px. The ladder is
 *                                  trimmed to 2x this, so a 160px
 *                                  thumbnail never offers an 800px rung.
 * @returns {{src: string, srcSet: string, sizes: string, lqip: string}}
 */
export const posterSources = (url, { sizes = '100vw', maxWidth = 400, variants = null } = {}) => {
  // ── Signed variants, when the API supplied them ────────────────────
  // The server signs each transformation with the account secret, so the
  // client can no longer mint its own URLs — and must not try. When
  // `variants` is present it is the only source used: building a
  // transform here would produce an unsigned URL, which is exactly what
  // signing exists to prevent, and it would fail outright once strict
  // transformations are enforced.
  if (variants) {
    const rungs = WIDTH_LADDER
      .filter((w) => w <= Math.min(Math.round(maxWidth * 2), BREAK_EVEN_WIDTH))
      .map((w) => [w, variants[`w${w}`]])
      .filter(([, u]) => Boolean(u));

    // Above the break-even width the stored rendition is both larger in
    // pixels and smaller in bytes, so it is the top rung.
    if (maxWidth * 2 > BREAK_EVEN_WIDTH && variants.full) {
      rungs.push([STORED_MAX_WIDTH, variants.full]);
    }

    if (rungs.length === 0) {
      return { src: variants.full || '', srcSet: '', sizes, lqip: variants.lqip || '' };
    }

    return {
      src: rungs[Math.floor(rungs.length / 2)][1],
      srcSet: rungs.map(([w, u]) => `${u} ${w}w`).join(', '),
      sizes,
      lqip: variants.lqip || '',
    };
  }

  if (!url) return { src: '', srcSet: '', sizes, lqip: '' };

  if (!isCloudinary(url)) {
    // A non-Cloudinary URL cannot be resized, so it is offered as-is
    // rather than being decorated with transforms that would 404.
    return { src: url, srcSet: '', sizes, lqip: '' };
  }

  // 2x covers the densest screen worth serving; beyond that the extra
  // pixels are not perceivable and the bytes are real.
  const ceiling = Math.min(Math.round(maxWidth * 2), STORED_MAX_WIDTH);
  const rungs = WIDTH_LADDER.filter((w) => w <= ceiling);
  // Anything rendering wider than the break-even point is offered the
  // stored file as its top rung — it is both larger in pixels and
  // smaller in bytes than a re-encode would be.
  if (ceiling > BREAK_EVEN_WIDTH || rungs.length === 0) rungs.push(STORED_MAX_WIDTH);

  return {
    // The fallback for browsers ignoring srcset: the middle rung, not the
    // largest, so an old browser is not punished with the biggest file.
    src: atWidth(url, rungs[Math.floor(rungs.length / 2)]),
    srcSet: rungs.map((w) => `${atWidth(url, w)} ${w}w`).join(', '),
    sizes,
    lqip: placeholder(url),
  };
};

export default degrade;
