import express from 'express';
import {
  createRazorpayOrder,
  verifyPayment,
  getMyOrders,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} from './orderController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';
import { paymentLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Every route below requires a valid session. Nothing under /api/orders
// is anonymous — the previous open admin routes exposed buyer names,
// emails, phone numbers and delivery addresses to any caller.
router.use(protect);

// ─── Customer ───
router.post('/create-razorpay-order', authorize('customer'), paymentLimiter, createRazorpayOrder);
router.post('/verify-payment', authorize('customer'), paymentLimiter, verifyPayment);
// Coupon validation moved to POST /api/coupons/validate, which carries
// its own rate limit against code enumeration.
router.get('/my-orders', authorize('customer'), getMyOrders);
router.put('/:id/cancel', authorize('customer'), cancelOrder);

// ─── Admin ───
router.get('/', authorize('admin'), getAllOrders);
router.put('/:id/status', authorize('admin'), updateOrderStatus);

// Shared: the controller enforces owner-or-admin on the specific record.
router.get('/:id', getOrder);

export default router;
