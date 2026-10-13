import Product from './Product.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import AppError from '../../utils/AppError.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import { diff } from '../../utils/auditLog.js';
import { parsePaging, buildPagination, escapeRegex } from '../../utils/pagination.js';
import { categoryCondition } from '../../utils/categories.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinaryUpload.js';
import { triggerReindex } from '../ai/aiSync.js';
import { withSignedImages, withSignedImagesAll } from '../../utils/productImages.js';

// Fields a client is permitted to set. Anything else in the request body
// is ignored â€” previously the whole body was passed to findByIdAndUpdate,
// which let a caller overwrite `createdBy`, `images`, or flip `isActive`.
const WRITABLE_FIELDS = ['title', 'description', 'price', 'category', 'stock', 'sizes', 'isActive'];

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// Card fields only. The storefront grid never renders the description, so
// shipping it for every product in a 12-item page is wasted bytes.
//
// `isActive` is included even though the storefront only ever sees live
// products: the admin list asks for inactive ones too via includeInactive,
// and without this field every row arrived with isActive === undefined and
// rendered as "Discontinued".
/**
 * The admin dashboard needs each image's public id so it can delete
 * individual images; the storefront has no use for it, so it is withheld
 * there rather than published for no reason.
 */
const isAdminRequest = (req) => req.user?.role === 'admin';

const CARD_FIELDS = 'title price category images stock sizes createdAt isActive';

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

/** Coerce and validate the size array so junk cannot reach the document. */
const normalizeSizes = (sizes) => {
  if (sizes === undefined) return undefined;
  if (!Array.isArray(sizes)) throw new AppError('`sizes` must be an array', 400);
  return sizes.map((s) => {
    const modifier = Number(s.priceModifier ?? 0);
    if (!s.label || typeof s.label !== 'string') {
      throw new AppError('Every size needs a label', 400);
    }
    if (!Number.isFinite(modifier)) {
      throw new AppError(`Invalid price modifier for size "${s.label}"`, 400);
    }
    return { label: s.label.trim(), priceModifier: modifier };
  });
};

// @desc    Get all active products with filters and pagination
// @route   GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const { category, search, size, minPrice, maxPrice, sort = 'price_asc', ids } = req.query;

  // Capped so a caller cannot request the entire catalogue in one response.
  const { page, limit, skip } = parsePaging(req, { defaultLimit: 12, maxLimit: 100 });

  // The storefront only ever sees live products. An admin can opt into
  // seeing deactivated ones so the dashboard can manage them.
  const query = {};
  if (!(req.user?.role === 'admin' && req.query.includeInactive === 'true')) {
    query.isActive = true;
  }
  // Match on one label, not the whole stored string: a product filed as
  // "Marvel, Doom" must appear under both Marvel and Doom.
  if (category) {
    const condition = categoryCondition(category);
    if (condition) query.category = condition.category;
  }

  if (search) {
    const escaped = escapeRegex(search);
    query.title = { $regex: escaped, $options: 'i' };
  }

  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    query.price = {};
    if (Number.isFinite(min)) query.price.$gte = min;
    if (Number.isFinite(max)) query.price.$lte = max;
  }

  if (size) query['sizes.label'] = size;

  // The grid never renders descriptions, so they stay out of the default
  // projection. The AI indexer does need them — it embeds the description
  // as the richest part of each product's text — so it opts in explicitly
  // rather than every storefront page paying for the extra bytes.
  // Descriptions are public either way; this is a payload-size choice.
  const projection =
    req.query.includeDescription === 'true' ? `${CARD_FIELDS} description` : CARD_FIELDS;

  const sortOption =
    sort === 'price_desc' ? { price: -1 } :
    sort === 'newest' ? { createdAt: -1 } :
    { price: 1 };

  // Fetch by specific IDs (used by the AI service to refresh stale
  // vector-store payloads with current MongoDB prices/stock).
  // Accepts a comma-separated list of product IDs.
  if (ids) {
    // Capped like any other query: an unbounded `$in` would let one
    // request pull the whole catalogue by listing every id.
    const idList = ids
      .split(',')
      .map((s) => s.trim())
      // Anything that is not a 24-hex ObjectId would make `$in` throw a
      // CastError and turn a bad query string into a 500.
      .filter((s) => OBJECT_ID_RE.test(s))
      .slice(0, limit);

    if (idList.length) {
      // `query` already carries the isActive rule (and the admin opt-out),
      // so reuse it rather than restating isActive and drifting from it.
      const products = await Product.find({ ...query, _id: { $in: idList } })
        .select(projection)
        .lean();

      // Preserve the caller's order; MongoDB returns `$in` results in
      // index order, and the AI service relies on relevance ranking.
      const byId = new Map(products.map((p) => [String(p._id), p]));
      const ordered = idList.map((id) => byId.get(id)).filter(Boolean);

      return res.status(200).json({
        success: true,
        data: {
          // Signed here rather than in the model so the raw secure_url
          // never leaves the server. isAdmin decides whether the public
          // id travels with it.
          products: withSignedImagesAll(ordered, { includePublicId: isAdminRequest(req) }),
          pagination: buildPagination(ordered.length, { page: 1, limit }),
        },
      });
    }
  }

  // Run the page query and the count concurrently rather than in series.
  const [products, total] = await Promise.all([
    Product.find(query)
      .select(projection)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      products: withSignedImagesAll(products, { includePublicId: isAdminRequest(req) }),
      pagination: buildPagination(total, { page, limit }),
    },
  });
});

// @desc    Filter facets for the shop sidebar
// @route   GET /api/products/facets
export const getFacets = asyncHandler(async (req, res) => {
  // The storefront used to build its filter UI by downloading the entire
  // catalogue (`/products?limit=1000`) and reducing it in the browser.
  // This computes the same three facets inside MongoDB and returns a few
  // hundred bytes instead of the whole product list.
  const [result] = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $facet: {
        // Split the comma-separated string into its labels before
        // grouping, so "Marvel", "Marvel, Doom" and "Marvel, SpiderMan"
        // contribute one "Marvel" entry rather than three filters.
        // $trim covers rows written before the schema setter existed,
        // where the separator may have been a bare "," with no space.
        categories: [
          { $project: { label: { $split: ['$category', ','] } } },
          { $unwind: '$label' },
          { $project: { label: { $trim: { input: '$label' } } } },
          { $match: { label: { $ne: '' } } },
          // Fold case so "marvel" and "Marvel" cannot both appear;
          // keep the first spelling for display.
          { $group: { _id: { $toLower: '$label' }, label: { $first: '$label' } } },
          { $sort: { _id: 1 } },
        ],
        sizes: [{ $unwind: '$sizes' }, { $group: { _id: '$sizes.label' } }, { $sort: { _id: 1 } }],
        priceBounds: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
      },
    },
  ]);

  const bounds = result?.priceBounds?.[0];

  res.status(200).json({
    success: true,
    data: {
      categories: (result?.categories || []).map((c) => c.label).filter(Boolean),
      sizes: (result?.sizes || []).map((s) => s._id).filter(Boolean),
      priceBounds: {
        min: Math.floor(bounds?.min ?? 0),
        max: Math.ceil(bounds?.max ?? 0),
      },
    },
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).lean();

  // Admins can read a deactivated product â€” otherwise the admin dashboard
  // cannot open one to edit or re-activate it.
  if (!product || (!product.isActive && req.user?.role !== 'admin')) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { product: withSignedImages(product, { includePublicId: isAdminRequest(req) }) },
  });
});

// @desc    Create product (admin)
// @route   POST /api/products
export const createProduct = asyncHandler(async (req, res, next) => {
  const fields = pick(req.body, WRITABLE_FIELDS);

  if (!fields.title || !fields.description || !fields.category) {
    return next(new AppError('Title, description and category are required', 400));
  }

  const price = Number(fields.price);
  const stock = Number(fields.stock ?? 0);
  if (!Number.isFinite(price) || price < 0) return next(new AppError('Invalid price', 400));
  if (!Number.isInteger(stock) || stock < 0) return next(new AppError('Invalid stock quantity', 400));

  const product = await Product.create({
    ...fields,
    price,
    stock,
    sizes: normalizeSizes(fields.sizes) ?? [],
    createdBy: req.user._id,
  });

  setAuditChanges(res, { productId: String(product._id), title: product.title, price, stock });
  // Async re-index: new poster is immediately discoverable via chatbot
  triggerReindex('createProduct');

  res.status(201).json({ success: true, data: { product } });
});

// @desc    Update product (admin)
// @route   PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404));

  const updates = pick(req.body, WRITABLE_FIELDS);
  if (updates.sizes !== undefined) updates.sizes = normalizeSizes(updates.sizes);
  if (updates.price !== undefined) {
    updates.price = Number(updates.price);
    if (!Number.isFinite(updates.price) || updates.price < 0) {
      return next(new AppError('Invalid price', 400));
    }
  }
  if (updates.stock !== undefined) {
    updates.stock = Number(updates.stock);
    if (!Number.isInteger(updates.stock) || updates.stock < 0) {
      return next(new AppError('Invalid stock quantity', 400));
    }
  }

  const before = pick(product.toObject(), WRITABLE_FIELDS);
  Object.assign(product, updates);
  await product.save(); // runs schema validators, unlike a raw findByIdAndUpdate

  setAuditChanges(res, {
    productId: String(product._id),
    ...diff(before, pick(product.toObject(), WRITABLE_FIELDS)),
  });
  triggerReindex('updateProduct');

  res.status(200).json({ success: true, data: { product } });
});

// @desc    Permanently delete product (admin)
// @route   DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404));

  if (product.images?.length) {
    await Promise.allSettled(
      product.images.filter((img) => img.publicId).map((img) => deleteFromCloudinary(img.publicId))
    );
  }

  // Hard delete. Order items keep their title/price/imageUrl snapshots;
  // the populated product ref resolves to null and the order endpoints
  // already flag those items as discontinued.
  await Product.deleteOne({ _id: product._id });

  setAuditChanges(res, {
    productId: String(product._id),
    title: product.title,
    imagesRemoved: product.images?.length || 0,
  });

  // Create and update re-indexed but delete did not, so the chatbot went
  // on recommending a poster that no longer exists.
  triggerReindex('deleteProduct');

  res.status(200).json({
    success: true,
    message: 'Product and all associated data permanently removed.',
  });
});

// @desc    Upload image to product (admin)
// @route   POST /api/products/:id/images
export const uploadProductImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('Please upload an image file', 400));

  const product = await Product.findById(req.params.id).select('_id images');
  if (!product) return next(new AppError('Product not found', 404));

  if (product.images.length >= 8) {
    return next(new AppError('A product can hold at most 8 images', 400));
  }

  const result = await uploadToCloudinary(req.file.buffer, 'the_print_labs/products');

  // Push atomically rather than reading, mutating and saving the whole
  // document â€” two concurrent uploads used to be able to lose one.
  const updated = await Product.findByIdAndUpdate(
    req.params.id,
    { $push: { images: { url: result.secure_url, publicId: result.public_id } } },
    { new: true }
  );

  setAuditChanges(res, {
    productId: req.params.id,
    publicId: result.public_id,
    bytes: result.bytes,
  });

  res.status(200).json({ success: true, data: { product: updated } });
});

// @desc    Remove image from product (admin)
// @route   DELETE /api/products/:id/images/:pubId
export const removeProductImage = asyncHandler(async (req, res, next) => {
  const publicId = decodeURIComponent(req.params.pubId);

  const product = await Product.findById(req.params.id).select('_id images');
  if (!product) return next(new AppError('Product not found', 404));
  if (!product.images.some((img) => img.publicId === publicId)) {
    return next(new AppError('Image not found on this product', 404));
  }

  await deleteFromCloudinary(publicId);

  const updated = await Product.findByIdAndUpdate(
    req.params.id,
    { $pull: { images: { publicId } } },
    { new: true }
  );

  setAuditChanges(res, { productId: req.params.id, publicId });

  res.status(200).json({ success: true, data: { product: updated } });
});


