import draftRevisiService from '../services/draftRevisi.service.js';

/**
 * Scheduler untuk job-job periodik
 * Sesuai diagram sequence: Job cek deadline revisi (otomatis)
 */

class Scheduler {
  constructor() {
    this.jobs = [];
    this.intervals = {};
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log('🚀 [SCHEDULER] Starting scheduled jobs...');

    // Job: Check expired revisions every 5 minutes
    this.scheduleJob('checkExpiredRevisions', async () => {
      try {
        console.log('⏰ [SCHEDULER] Running checkExpiredRevisions job...');
        const result = await draftRevisiService.checkExpiredRevisions();
        console.log(`✅ [SCHEDULER] checkExpiredRevisions completed: ${result.processed} processed`);
      } catch (error) {
        console.error('❌ [SCHEDULER] checkExpiredRevisions error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log('✅ [SCHEDULER] All jobs scheduled');
  }

  /**
   * Schedule a job to run at interval
   */
  scheduleJob(name, fn, intervalMs) {
    console.log(`📅 [SCHEDULER] Scheduling job "${name}" every ${intervalMs / 1000}s`);

    // Run immediately on start
    setTimeout(() => {
      console.log(`🏃 [SCHEDULER] Running initial "${name}" job...`);
      fn();
    }, 10000); // Wait 10s after server start

    // Then run at interval
    this.intervals[name] = setInterval(fn, intervalMs);
    this.jobs.push({ name, intervalMs });
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('🛑 [SCHEDULER] Stopping all jobs...');

    for (const name in this.intervals) {
      clearInterval(this.intervals[name]);
      console.log(`⏹️ [SCHEDULER] Stopped job "${name}"`);
    }

    this.intervals = {};
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    return {
      running: Object.keys(this.intervals).length > 0,
      jobs: this.jobs.map(job => ({
        name: job.name,
        intervalMs: job.intervalMs,
        intervalText: `${job.intervalMs / 1000}s`
      }))
    };
  }
}

export default new Scheduler();
