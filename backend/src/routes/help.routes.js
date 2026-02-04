import express from 'express';
import { query, param } from 'express-validator';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import helpService from '../services/help.service.js';
import guardService from '../services/guard.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/help/sop:
 *   get:
 *     summary: Ambil SOP kontekstual berdasarkan context
 *     tags: [Help]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contextType
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: contextCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Konten SOP
 */
router.get('/sop', authenticateToken, authorizeRoles('admin_finance'), [
  query('contextType').isString().notEmpty(),
  query('contextCode').isString().notEmpty()
], async (req, res) => {
  try {
    const { contextType, contextCode } = req.query;
    const userRole = req.user.role;

    // Validate access to SOP
    const accessGranted = await guardService.validateSOAccess(userRole, contextType, contextCode);
    if (!accessGranted) {
      return res.status(403).json({ success: false, message: 'Akses SOP ditolak untuk peran Anda' });
    }

    const sop = await helpService.getContextualSOP(contextType, contextCode, userRole);

    res.json({
      success: true,
      data: sop
    });
  } catch (error) {
    console.error('Get SOP error:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

export default router;