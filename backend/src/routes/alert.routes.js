import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authenticateToken, guardPersonalData } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Ambil peringatan personal
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Hanya tampilkan yang belum dibaca
 *     responses:
 *       200:
 *         description: Daftar peringatan
 */
router.get('/', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unreadOnly === 'true';

    let queryText = `
      SELECT id, alert_type, title, message, severity, is_read, 
             related_entity_type, related_entity_id, created_at
      FROM personal_alerts 
      WHERE user_id = $1
    `;
    
    if (unreadOnly) {
      queryText += ' AND is_read = false';
    }
    
    queryText += ' ORDER BY created_at DESC LIMIT 50';

    const result = await query(queryText, [userId]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.alert_type,
        title: row.title,
        message: row.message,
        severity: row.severity,
        isRead: row.is_read,
        relatedEntity: row.related_entity_type ? {
          type: row.related_entity_type,
          id: row.related_entity_id
        } : null,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil peringatan'
    });
  }
});

/**
 * @swagger
 * /api/alerts/{id}/read:
 *   post:
 *     summary: Tandai peringatan sebagai sudah dibaca
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Peringatan ditandai
 */
router.post('/:id/read', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      `UPDATE personal_alerts 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Peringatan tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Peringatan ditandai sebagai sudah dibaca'
    });
  } catch (error) {
    console.error('Mark alert read error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menandai peringatan'
    });
  }
});

/**
 * @swagger
 * /api/alerts/read-all:
 *   post:
 *     summary: Tandai semua peringatan sebagai sudah dibaca
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Semua peringatan ditandai
 */
router.post('/read-all', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;

    await query(
      `UPDATE personal_alerts SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Semua peringatan ditandai sebagai sudah dibaca'
    });
  } catch (error) {
    console.error('Mark all alerts read error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menandai peringatan'
    });
  }
});

/**
 * @swagger
 * /api/alerts/count:
 *   get:
 *     summary: Hitung peringatan belum dibaca
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jumlah peringatan
 */
router.get('/count', authenticateToken, guardPersonalData, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_read = false) as critical,
        COUNT(*) FILTER (WHERE severity = 'warning' AND is_read = false) as warning
       FROM personal_alerts 
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        unread: parseInt(result.rows[0].unread),
        critical: parseInt(result.rows[0].critical),
        warning: parseInt(result.rows[0].warning)
      }
    });
  } catch (error) {
    console.error('Count alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghitung peringatan'
    });
  }
});

export default router;
