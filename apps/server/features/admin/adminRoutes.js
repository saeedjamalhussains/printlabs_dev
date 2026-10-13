import express from 'express';
import {
  getUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  updateProductStatus,
  deleteProduct,
  deleteOrder,
  getAnalytics,
} from './adminController.js';
import {
  listCloudinaryResources,
  getCloudinaryUsage,
  deleteCloudinaryResource,
} from './cloudinaryController.js';
// Order status/refund logic lives with the orders feature; the admin
// router just exposes it under an /admin path.
import { refundOrder, updateOrderStatus } from '../orders/orderController.js';
import { listAuditLog, getAuditStats } from './auditController.js';
import {
  createNewsletter,
  deleteNewsletter,
  listNewsletters,
} from '../newsletter/newsletterController.js';

import { protect } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';

const router = express.Router();

// Every endpoint in this router requires a signed-in user holding the
// admin role. Applied once at the router level so a newly added route
// cannot accidentally ship unauthenticated.
router.use(protect, authorize('admin'));

router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// Product management
router.put('/products/:id/status', updateProductStatus);
router.delete('/products/:id', deleteProduct);

// Order management
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/refund', refundOrder);
router.delete('/orders/:id', deleteOrder);
router.get('/analytics', getAnalytics);

// Cloudinary management
router.get('/cloudinary', listCloudinaryResources);
router.get('/cloudinary/usage', getCloudinaryUsage);
router.delete('/cloudinary/:publicId', deleteCloudinaryResource);

// Newsletter (admin compose / list / delete)
router.get('/newsletter', listNewsletters);
router.post('/newsletter', createNewsletter);
router.delete('/newsletter/:id', deleteNewsletter);

// Blackbox audit trail (read-only — the log itself is append-only on disk)
router.get('/audit', listAuditLog);
router.get('/audit/stats', getAuditStats);

// Coupons live in their own feature module, mounted at /api/coupons.

export default router;
