import { signedVariants } from './signedImage.js';

/**
 * Serialise a product for a client response, replacing raw Cloudinary
 * delivery URLs with signed ones.
 *
 * ── Why the shape barely changes ──────────────────────────────────────
 * `images[].url` keeps its name and keeps being a URL, so every existing
 * consumer — the cart, the AI assistant, order pricing, the admin —
 * carries on working untouched. What changes is that the string is now a
 * *signed* URL rather than the raw `secure_url` stored at upload. The
 * responsive ladder is added next to it as `images[].variants`.
 *
 * ── Why there is no fallback to the raw URL ──────────────────────────
 * If signing fails, this drops the image rather than quietly emitting the
 * unsigned URL. An unsigned URL is precisely the thing being removed: it
 * can be edited to any transformation the account will serve. Falling
 * back to it "so the image still shows" would recreate the hole at
 * exactly the moment something is already wrong, and it would do so
 * silently. Failing visibly is the safer outcome, and the server logs
 * enough to act on.
 */

/**
 * @param {object} product  A lean product object or Mongoose document.
 * @param {object} options
 * @param {boolean} options.includePublicId  Admin responses need the
 *   public id to delete images. Storefront responses do not, so it is
 *   withheld there — with strict transformations enabled the id alone
 *   cannot be turned into a delivery URL, but there is no reason to
 *   publish it either.
 * @returns {object} The product with signed image URLs.
 */
export const withSignedImages = (product, { includePublicId = false } = {}) => {
  if (!product) return product;

  const plain = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  if (!Array.isArray(plain.images) || plain.images.length === 0) return plain;

  plain.images = plain.images.reduce((kept, image) => {
    const variants = signedVariants(image.publicId);

    if (!variants) {
      // No public id means this row predates signed delivery or was
      // written by hand. It is logged rather than passed through.
      console.error(
        '[images] cannot sign image without a publicId; omitting it from the response',
        { productId: plain._id, url: image.url }
      );
      return kept;
    }

    kept.push({
      // Same field, same meaning, now signed. `full` is the stored 800px
      // rendition — see features/images/uploadPresets.js — not a master.
      url: variants.full,
      variants,
      ...(includePublicId ? { publicId: image.publicId } : {}),
    });
    return kept;
  }, []);

  return plain;
};

/** Convenience for list endpoints. */
export const withSignedImagesAll = (products, options) =>
  (products || []).map((p) => withSignedImages(p, options));

export default withSignedImages;
