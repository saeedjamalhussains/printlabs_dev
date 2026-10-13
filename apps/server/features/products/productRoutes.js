import express from 'express';
import {
  getProducts,
  getFacets,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  removeProductImage,
} from './productController.js';
import { upload } from '../../middleware/upload.js';
import { protect, optionalAuth } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';

const router = express.Router();

// Catalogue reads stay public; every write requires an admin session.
const adminOnly = [protect, authorize('admin')];

router.route('/')
  // optionalAuth so an admin can additionally request inactive products,
  // while anonymous shoppers still get the live catalogue only.
  .get(optionalAuth, getProducts)
  .post(adminOnly, createProduct);

// Must be declared before '/:id' or it would be captured as an id.
router.get('/facets', getFacets);

router.route('/:id')
  .get(optionalAuth, getProduct)
  .put(adminOnly, updateProduct)
  .delete(adminOnly, deleteProduct);


router.post('/:id/images', adminOnly, upload.single('image'), uploadProductImage);
router.delete('/:id/images/:pubId', adminOnly, removeProductImage);

export default router;
