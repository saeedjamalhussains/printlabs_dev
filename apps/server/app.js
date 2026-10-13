import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';

import authRoutes from './features/auth/authRoutes.js';
import productRoutes from './features/products/productRoutes.js';
import orderRoutes from './features/orders/orderRoutes.js';
import adminRoutes from './features/admin/adminRoutes.js';
import newsletterRoutes from './features/newsletter/newsletterRoutes.js';
import couponRoutes from './features/coupons/couponRoutes.js';
import aiRoutes from './features/ai/aiRoutes.js';

import { generalLimiter } from './middleware/rateLimiter.js';
import { requestId, auditMiddleware } from './middleware/auditMiddleware.js';
import errorHandler from './middleware/errorHandler.js';
import AppError from './utils/AppError.js';

const app = express();

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.disable('x-powered-by');
app.disable('etag');

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176']),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(`CORS blocked for origin: ${origin}`, 403));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const stripOperators = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 6) return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    stripOperators(obj[key], depth + 1);
  }
};

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = mongoSanitize.sanitize(req.body);
  if (req.params && typeof req.params === 'object') req.params = mongoSanitize.sanitize(req.params);
  if (req.query && typeof req.query === 'object') stripOperators(req.query);
  next();
});

app.use(hpp());
app.use(compression({ threshold: 1024 }));
app.use(requestId);

app.use('/api', generalLimiter);
app.use('/api', auditMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/chat', aiRoutes);

app.get('/', (req, res) => res.send('ThePrintLabs API is running...'));
app.get('/health', (req, res) =>
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) })
);

app.use((req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404)));
app.use(errorHandler);

export default app;
