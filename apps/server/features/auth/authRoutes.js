import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteMe,
} from './authController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/me/password', protect, changePassword);
router.delete('/me', protect, deleteMe);

export default router;
