import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import systemNoticeService from '../services/systemNotice.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/approval/notices:
 *   get:
 *     summary: Get System Notices (Behavioral Nudge)
 *     description: |
 *       Returns neutral system notices based on behavioral evaluation.
 *       Selection logic is hidden from the user. Delivery is regulated by TER.
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system notices
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, authorizeRoles('approval'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch applicable notices using service
    const notices = await systemNoticeService.getApplicableNotices(userId);

    res.json({
      success: true,
      data: notices
    });
  } catch (error) {
    console.error('System notices route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system notices'
    });
  }
});

export default router;
