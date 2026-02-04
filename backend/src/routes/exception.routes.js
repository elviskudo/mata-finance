import express from 'express';
import { body, validationResult, param } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles, guardPersonalData } from '../middleware/auth.middleware.js';
import exceptionService from '../services/exception.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/exceptions:
 *   get:
 *     summary: Ambil daftar exception cases milik user
 *     tags: [Exceptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar exception cases
 */
router.get('/', authenticateToken, authorizeRoles('admin_finance'), guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;

    const cases = await exceptionService.getCases(userId);

    res.json({
      success: true,
      data: cases
    });
  } catch (error) {
    console.error('Get exceptions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/exceptions/{caseId}:
 *   get:
 *     summary: Ambil detail exception case
 *     tags: [Exceptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail exception case
 */
router.get('/:caseId', authenticateToken, authorizeRoles('admin_finance'), guardPersonalData, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    const caseData = await exceptionService.getCase(caseId, userId);

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Exception case not found' });
    }

    res.json({
      success: true,
      data: caseData
    });
  } catch (error) {
    console.error('Get exception case error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/exceptions/{caseId}/patch:
 *   put:
 *     summary: Patch exception case
 *     tags: [Exceptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patch:
 *                 type: object
 *                 description: Object containing field patches
 *     responses:
 *       200:
 *         description: Patch berhasil
 */
router.put('/:caseId/patch', authenticateToken, authorizeRoles('admin_finance'), guardPersonalData, [
  body('patch').isObject().notEmpty()
], async (req, res) => {
  try {
    const { caseId } = req.params;
    const { patch } = req.body;
    const userId = req.user.id;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
    }

    await exceptionService.patchCase(caseId, userId, patch);

    res.json({
      success: true,
      message: 'Patch saved successfully'
    });
  } catch (error) {
    console.error('Patch exception case error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/exceptions/{caseId}/recheck:
 *   post:
 *     summary: Recheck OCR dengan patch overlay
 *     tags: [Exceptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hasil recheck
 */
router.post('/:caseId/recheck', authenticateToken, authorizeRoles('admin_finance'), guardPersonalData, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    const result = await exceptionService.recheckCase(caseId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Recheck exception case error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;