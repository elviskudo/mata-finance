import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token autentikasi diperlukan'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists, is active, and login_id matches (session validation)
    const result = await query(
      'SELECT id, role, department, is_active, login_id, public_alias FROM users WHERE id = $1 AND login_id = $2',
      [decoded.userId, decoded.loginId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak valid atau sudah berakhir'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Akun telah dinonaktifkan'
      });
    }

    // Attach ONLY anonymous user data to request
    // NEVER expose real name or email in req.user
    req.user = {
      id: user.id,
      loginId: user.login_id,
      publicAlias: user.public_alias,
      role: user.role,
      department: user.department
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token telah kedaluwarsa'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan autentikasi'
    });
  }
};

// Role-based access control
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Tidak terautentikasi'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki izin untuk mengakses resource ini'
      });
    }

    next();
  };
};

// Data access guard - only personal data
export const guardPersonalData = (req, res, next) => {
  // Store userId for filtering queries
  req.accessScope = {
    userId: req.user.id,
    role: req.user.role,
    allowCompanyData: false // Admin Finance cannot access company financial data
  };
  next();
};

// Anonymity guard - strips real identity from responses
export const anonymizeResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    // Recursively remove sensitive fields
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      const sanitized = { ...obj };
      
      // Remove real identity fields
      delete sanitized.email;
      delete sanitized.fullName;
      delete sanitized.full_name;
      delete sanitized.realName;
      
      // Recursively sanitize nested objects
      for (const key in sanitized) {
        if (typeof sanitized[key] === 'object') {
          sanitized[key] = sanitize(sanitized[key]);
        }
      }
      
      return sanitized;
    };
    
    return originalJson(sanitize(data));
  };
  
  next();
};
