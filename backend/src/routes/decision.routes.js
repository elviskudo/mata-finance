import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import decisionHistoryService from '../services/decisionHistory.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/approval/my-decisions:
 *   get:
 *     summary: Get Personal Decision History (Limited Memory)
 *     description: |
 *       Returns a scoped and reduced list of past decisions for the current approval officer.
 *       Follows DRE (Data Reduction Engine) rules: only item type, outcome, and relative time.
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-decisions', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const approvalId = req.user.id;
    
    // Fetch reduced decisions using service
    const decisions = await decisionHistoryService.getPersonalDecisions(approvalId);

    res.json({
      success: true,
      data: decisions
    });
  } catch (error) {
    console.error('My Decisions route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve decision history'
    });
  }
});

export default router;
