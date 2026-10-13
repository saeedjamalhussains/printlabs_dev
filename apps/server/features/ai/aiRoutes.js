import express from 'express';
import { chatWithAssistant } from './aiController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { chatLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Signed-in customers only.
//
// Hiding the widget from anonymous visitors is presentation; this is the
// part that matters. Every message reaches an LLM that bills per call, so
// an open endpoint is a way to spend the store's money without ever
// loading the site.
//
// The limiter is its own bucket rather than the shared generalLimiter:
// 200 requests per window is reasonable for dashboard reads and far too
// generous for paid model calls.
router.post('/', protect, chatLimiter, chatWithAssistant);

export default router;
