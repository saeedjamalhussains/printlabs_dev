import express from 'express';
import {
  validateCoupon,
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  reconcileCoupon,
} from './couponController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';
import { couponLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.use(protect);

// Customer: check a code against their own cart.
// Rate limited on its own bucket — this endpoint answers "does this code
// exist and what is it worth", which is exactly what a script needs to
// enumerate valid codes.
router.post('/validate', authorize('customer'), couponLimiter, validateCoupon);

// Admin CRUD.
const adminOnly = authorize('admin');
router.get('/', adminOnly, getCoupons);
router.post('/', adminOnly, createCoupon);
router.get('/:id', adminOnly, getCoupon);
router.put('/:id', adminOnly, updateCoupon);
router.delete('/:id', adminOnly, deleteCoupon);
router.post('/:id/reconcile', adminOnly, reconcileCoupon);

export default router;
