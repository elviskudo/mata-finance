import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import exceptionRoutes from './routes/exception.routes.js';
import alertRoutes from './routes/alert.routes.js';
import helpRoutes from './routes/help.routes.js';
import approvalRoutes from './routes/approval.routes.js';
import systemNoticeRoutes from './routes/systemNotice.routes.js';
import decisionRoutes from './routes/decision.routes.js';


// Import scripts
import checkRevisionDeadlines from './scripts/deadline-checker.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mata Finance API',
      version: '1.0.0',
      description: 'API untuk Dashboard Admin Finance - Mata Finance',
      contact: {
        name: 'Support',
        email: 'support@matafinance.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Mata Finance API Documentation'
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/exceptions', exceptionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/approval', approvalRoutes);
app.use('/api/approval/notices', systemNoticeRoutes);
app.use('/api/approval', decisionRoutes);

app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau kedaluwarsa'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Start deadline checker job (every 1 hour)
setInterval(checkRevisionDeadlines, 60 * 60 * 1000); // 1 hour
// Run once on startup
checkRevisionDeadlines();

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📚 API Docs tersedia di http://localhost:${PORT}/api-docs`);
});

export default app;
