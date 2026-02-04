import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import auditService from '../services/audit.service.js';

const router = express.Router();

// Valid roles in the system
const VALID_ROLES = ['admin_finance', 'approval'];

/**
 * Generate a unique public alias for anonymity
 * Format: ROLE_PREFIX-XXXX (e.g., FIN-1234, APR-5678)
 */
const generatePublicAlias = async (role) => {
  const prefix = role === 'approval' ? 'APR' : 'FIN';
  let alias;
  let exists = true;
  
  while (exists) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    alias = `${prefix}-${randomNum}`;
    
    const check = await query('SELECT id FROM users WHERE public_alias = $1', [alias]);
    exists = check.rows.length > 0;
  }
  
  return alias;
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register user baru (Admin Finance atau Approval)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin_finance, approval]
 *               department:
 *                 type: string
 *     responses:
 *       201:
 *         description: User berhasil dibuat
 *       400:
 *         description: Validation error
 */
router.post('/register', [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
  body('fullName').notEmpty().withMessage('Nama lengkap wajib diisi'),
  body('role').isIn(VALID_ROLES).withMessage('Role harus admin_finance atau approval')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, fullName, role, department } = req.body;

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique identifiers for anonymity
    const loginId = uuidv4();
    const publicAlias = await generatePublicAlias(role);
    const defaultDept = role === 'approval' ? 'Approval' : 'Finance';
    
    // Create user
    const result = await query(
      `INSERT INTO users (id, email, password, full_name, role, department, login_id, public_alias) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, email, role, department, login_id, public_alias, created_at`,
      [uuidv4(), email, hashedPassword, fullName, role, department || defaultDept, loginId, publicAlias]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role, loginId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Return ONLY anonymous data - never expose real name or email to frontend
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user: {
          loginId: user.login_id,
          publicAlias: user.public_alias,
          role: user.role,
          department: user.department
        },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat registrasi'
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login berhasil
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').notEmpty().withMessage('Password wajib diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const result = await query(
      'SELECT id, email, password, full_name, role, department, is_active, login_id, public_alias FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Akun telah dinonaktifkan'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    // Generate new login_id for this session (invalidates old sessions)
    const newLoginId = uuidv4();
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP, login_id = $1 WHERE id = $2', [newLoginId, user.id]);

    // Log activity (using public_alias, not real name)
    auditService.logActivity(user.id, 'LOGIN', null, null, { 
      ipAddress: req.ip,
      publicAlias: user.public_alias 
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role, loginId: newLoginId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Return ONLY anonymous data - NEVER expose real name, email, or internal ID
    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          loginId: newLoginId,
          publicAlias: user.public_alias,
          role: user.role,
          department: user.department
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login'
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile (anonymous)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile (anonymous)
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, role, department, login_id, public_alias, last_login, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    const user = result.rows[0];

    // Return ONLY anonymous data
    res.json({
      success: true,
      data: {
        loginId: user.login_id,
        publicAlias: user.public_alias,
        role: user.role,
        department: user.department,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil profil'
    });
  }
});

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     summary: Validate session and token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session valid
 *       401:
 *         description: Invalid session
 */
router.get('/validate', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT login_id, public_alias, role, department FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak valid'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Sesi valid',
      data: {
        loginId: user.login_id,
        publicAlias: user.public_alias,
        role: user.role,
        department: user.department,
        accessScope: 'personal_data_only'
      }
    });
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan validasi'
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (invalidate session)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Invalidate current session by generating new login_id
    await query('UPDATE users SET login_id = $1 WHERE id = $2', [uuidv4(), req.user.id]);

    auditService.logActivity(req.user.id, 'LOGOUT', null, null, { ipAddress: req.ip });

    res.json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat logout'
    });
  }
});

export default router;
