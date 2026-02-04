import draftRevisiService from '../services/draftRevisi.service.js';

/**
 * Job untuk cek deadline revisi yang terlewati
 * Sesuai diagram sequence:
 * 
 * == Deadline terlewati (otomatis) ==
 * S -> DB: Job cek deadline revisi
 * DB --> S: item lewat deadline
 * S -> DB: status=CLOSED_NEEDS_ACCOUNTING_RESOLUTION (lock)
 * S -> AQ: Masukkan ke antrian Accounting Owner (needs_resolution)
 * S -> Ex: Buat exception silent (miss_deadline / no_action)
 * S -> Aud: Catat event auto-close + escalate
 */
async function checkRevisionDeadlines() {
  try {
    console.log('⏰ [DEADLINE-CHECKER] Checking revision deadlines...');

    const result = await draftRevisiService.checkExpiredRevisions();

    if (result.processed > 0) {
      console.log(`✅ [DEADLINE-CHECKER] Processed ${result.processed} expired revisions`);
    } else {
      console.log('✅ [DEADLINE-CHECKER] No expired revisions found');
    }

    return result;

  } catch (error) {
    console.error('❌ [DEADLINE-CHECKER] Error:', error);
    throw error;
  }
}

export default checkRevisionDeadlines;

// To run periodically, use setInterval in index.js
// Example: setInterval(checkRevisionDeadlines, 60 * 60 * 1000); // Every 1 hour