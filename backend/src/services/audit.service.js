import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export const logActivity = async (userId, action, entityType, entityId, details = {}) => {
  // Log user activity to activity_logs table (append-only)
  try {
    const timestamp = new Date();

    await query(
      `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        userId,
        action,
        entityType,
        entityId,
        JSON.stringify(details),
        timestamp
      ]
    );

    console.log(`📝 [ACTIVITY] User:${userId} Action:${action} Entity:${entityType}:${entityId}`);

  } catch (error) {
    console.error('Failed to log activity:', error);
    // Silent fail - activity logging shouldn't block main flow
  }
};

export const logSignal = async (userId, type, details, severity = 'INFO') => {
  // Silent Audit Layer
  // Records signals independent of standard activity logs for anomaly detection

  try {
    const timestamp = new Date();

    // Using activity_logs with a special prefix in action for signals
    await query(
      `INSERT INTO activity_logs (id, user_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuidv4(),
        userId,
        `SIGNAL_${type}`,
        JSON.stringify({ ...details, severity }),
        timestamp
      ]
    );

    console.log(`📡 [SILENT SIGNAL] User:${userId} Type:${type} Severity:${severity}`);

  } catch (error) {
    console.error('Failed to log signal:', error);
    // Silent fail - analytics shouldn't block main flow
  }
};

export default {
  logActivity,
  logSignal
};
