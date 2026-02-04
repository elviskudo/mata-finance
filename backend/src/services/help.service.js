import { query } from '../config/database.js';

class HelpService {
  async getContextualSOP(contextType, contextCode, role) {
    const result = await query(
      `SELECT title, content FROM sop_content WHERE context_type = $1 AND context_code = $2 AND role = $3`,
      [contextType, contextCode, role]
    );

    if (result.rows.length === 0) {
      throw new Error('SOP not found for this context');
    }

    return result.rows[0];
  }
}

export default new HelpService();