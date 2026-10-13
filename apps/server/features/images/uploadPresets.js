// Server-side image quality engine.
// This mirrors the client-side optimization logic but is applied at upload time
// so that stored Cloudinary assets are smaller. This permanently saves cloud storage
// rather than only optimizing final delivery.

const UPLOAD_PRESETS = {
  // Maximum compression for product images. This caps the longest edge at
  // 800px, drops the quality to 20 (visibly lossy), and converts the image to
  // WebP for the smallest footprint. A 5MB JPEG typically drops to
  // 15–30kB, resulting in a ~99% reduction in size.
  product: [
    { width: 800, crop: 'limit' },
    { quality: 20 },
    { fetch_format: 'webp' },
  ],

  // Light compression: 400px wide, quality 15. Use for thumbnails and secondary assets.
  light: [
    { width: 400, crop: 'limit' },
    { quality: 15 },
    { fetch_format: 'webp' },
  ],

  // No transformation. Use this option to preserve the original image asset.
  raw: null,
};

export const getUploadTransformation = (preset = 'product') => {
  const t = UPLOAD_PRESETS[preset];
  if (t === undefined) return UPLOAD_PRESETS.product;
  return t;
};
