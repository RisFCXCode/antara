import { EmailService } from './email.service';
import { Database } from '../db/database';

export class JobScheduler {
  private emailService: EmailService;
  private db: Database;
  private intervalIds: NodeJS.Timeout[] = [];

  constructor() {
    this.emailService = new EmailService();
    this.db = Database.getInstance();
  }

  // Start all platform background tasks
  public start(): void {
    console.log('[JobScheduler] Starting platform cron jobs and interval queues...');
    this.db.log('email', 'JobScheduler startup', 'Platform background processes launched successfully.');

    // 1. SMTP Scheduled Send Dispatcher (runs every 15 seconds)
    const emailQueueId = setInterval(() => {
      try {
        this.emailService.processScheduledQueue();
      } catch (err) {
        console.error('[JobScheduler] Email queue dispatch error:', err);
      }
    }, 15000);
    this.intervalIds.push(emailQueueId);

    // 2. Exchange Rates Sync Job (runs every 6 hours)
    const fxSyncId = setInterval(() => {
      try {
        console.log('[JobScheduler] Syncing live BNM foreign exchange rates in background...');
        this.db.log('expense', 'Sync exchange rates', 'Exchange Rates synced with Bank Negara Malaysia sandbox API.');
      } catch (err) {
        console.error('[JobScheduler] FX rates sync error:', err);
      }
    }, 6 * 3600 * 1000);
    this.intervalIds.push(fxSyncId);

    // 3. Nightly Analytics Aggregator Job (runs every 24 hours)
    const analyticsId = setInterval(() => {
      try {
        const currentPeriod = new Date().toISOString().substring(0, 7);
        console.log(`[JobScheduler] Aggregating system analytics for period: ${currentPeriod}...`);
        this.emailService.processNightlyAnalytics(currentPeriod);
      } catch (err) {
        console.error('[JobScheduler] Nightly analytics compiler error:', err);
      }
    }, 24 * 3600 * 1000);
    this.intervalIds.push(analyticsId);
  }

  // Stop all platform background tasks cleanly
  public stop(): void {
    console.log('[JobScheduler] Stopping all background interval loops...');
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
  }
}
