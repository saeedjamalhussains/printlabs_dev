import express from 'express';
import { listNewsletters, createNewsletter, deleteNewsletter } from './newsletterController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';

const router = express.Router();

// Public read — the storefront newsletter page renders this list.
router.get('/', listNewsletters);

// Writes require an admin session, same as the /api/admin/newsletter
// aliases of these handlers.
router.post('/', protect, authorize('admin'), createNewsletter);
router.delete('/:id', protect, authorize('admin'), deleteNewsletter);

export default router;
