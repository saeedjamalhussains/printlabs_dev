import Newsletter from './Newsletter.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import AppError from '../../utils/AppError.js';

// GET /api/newsletter — public
export const listNewsletters = asyncHandler(async (req, res) => {
  const items = await Newsletter.find({}).sort({ createdAt: -1 }).limit(50).lean();
  res.status(200).json({ success: true, data: { items } });
});

// POST /api/admin/newsletter — admin posts a new drop
export const createNewsletter = asyncHandler(async (req, res, next) => {
  const { title, body, imageUrl } = req.body || {};
  if (!title || !body) return next(new AppError('Title and body are required', 400));

  const item = await Newsletter.create({
    title: String(title).trim(),
    body: String(body).trim(),
    imageUrl: imageUrl ? String(imageUrl).trim() : '',
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, data: { item } });
});

// DELETE /api/admin/newsletter/:id
export const deleteNewsletter = asyncHandler(async (req, res, next) => {
  const item = await Newsletter.findByIdAndDelete(req.params.id);
  if (!item) return next(new AppError('Newsletter entry not found', 404));
  res.status(200).json({ success: true });
});
