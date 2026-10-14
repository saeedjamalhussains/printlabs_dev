import cloudinary from '../../config/cloudinary.js';
import Product from '../products/Product.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import AppError from '../../utils/AppError.js';

// @desc    List Cloudinary resources (admin)
// @route   GET /api/admin/cloudinary
export const listCloudinaryResources = asyncHandler(async (req, res, _next) => {
  const { next_cursor, prefix = 'the_print_labs/' } = req.query;

  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix,
    max_results: 50,
    next_cursor,
  });

  const resources = result.resources.map((r) => ({
    publicId: r.public_id,
    url: r.secure_url,
    format: r.format,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    folder: r.folder,
    createdAt: r.created_at,
  }));

  res.status(200).json({
    success: true,
    data: {
      resources,
      nextCursor: result.next_cursor || null,
    },
  });
});

// @desc    Cloudinary usage stats (admin)
// @route   GET /api/admin/cloudinary/usage
export const getCloudinaryUsage = asyncHandler(async (req, res, _next) => {
  try {
    const usage = await cloudinary.api.usage();

    return res.status(200).json({
      success: true,
      data: {
        plan: usage.plan ?? null,
        credits: usage.credits ?? null,
        bandwidth: usage.bandwidth ?? null,
        storage: usage.storage ?? null,
        requests: usage.requests ?? null,
        resources: usage.resources ?? null,
        derivedResources: usage.derived_resources ?? null,
      },
    });
  } catch (err) {
    // Cloudinary's /usage endpoint can fail on some plans or with
    // restricted API keys. Fall back to a usable shape so the UI keeps
    // working — surface a hint instead of crashing.
    console.error('[cloudinary/usage] failed:', err?.error?.message || err?.message || err);
    return res.status(200).json({
      success: true,
      data: {
        plan: null,
        credits: null,
        bandwidth: null,
        storage: null,
        requests: null,
        resources: null,
        derivedResources: null,
        unavailable: true,
        reason: err?.error?.message || err?.message || 'Cloudinary usage API unavailable',
      },
    });
  }
});

// @desc    Delete Cloudinary resource (admin)
// @route   DELETE /api/admin/cloudinary/:publicId
export const deleteCloudinaryResource = asyncHandler(async (req, res, next) => {
  const publicId = decodeURIComponent(req.params.publicId);
  if (!publicId) return next(new AppError('publicId is required', 400));

  const result = await cloudinary.uploader.destroy(publicId);
  if (result.result !== 'ok' && result.result !== 'not found') {
    return next(new AppError(`Cloudinary delete failed: ${result.result}`, 500));
  }

  // Destroying the asset used to leave every Product still holding its
  // url and publicId, so the storefront went on rendering an image that
  // no longer existed. Detach the reference wherever it appears.
  const detached = await Product.updateMany(
    { 'images.publicId': publicId },
    { $pull: { images: { publicId } } }
  );

  setAuditChanges(res, {
    publicId,
    cloudinaryResult: result.result,
    productsUpdated: detached.modifiedCount,
  });

  res.status(200).json({
    success: true,
    message:
      result.result === 'not found'
        ? `Resource ${publicId} was not on Cloudinary; removed ${detached.modifiedCount} stale product reference(s).`
        : `Resource ${publicId} deleted, detached from ${detached.modifiedCount} product(s).`,
    data: { productsUpdated: detached.modifiedCount },
  });
});
