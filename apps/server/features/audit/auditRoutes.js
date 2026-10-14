import express from 'express';
import { getAuditStats, listAuditLog } from './auditController.js';

const router = express.Router();

router.get('/', listAuditLog);
router.get('/stats', getAuditStats);

export default router;
