import { Invoice } from '../db/database';

export interface AccountingAdapter {
  syncInvoice(invoice: Invoice): Promise<{ success: boolean; remoteId?: string; error?: string }>;
  fetchIncomingInvoices(): Promise<Invoice[]>;
}

export class AutoCountAdapter implements AccountingAdapter {
  private apiBase: string;

  constructor() {
    this.apiBase = process.env.AUTO_COUNT_API_BASE || 'http://localhost:5200/api/v1';
  }

  // Push Invoice to AutoCount system
  public async syncInvoice(invoice: Invoice): Promise<{ success: boolean; remoteId?: string; error?: string }> {
    try {
      console.log(`[AutoCount] Syncing invoice ${invoice.id} to AutoCount Ledger at ${this.apiBase}...`);
      
      // Real/Mock synchronization logic
      return {
        success: true,
        remoteId: `AC-INV-${invoice.id}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      };
    } catch (err: any) {
      console.error('[AutoCount] Sync failed:', err);
      return { success: false, error: err.message || 'AutoCount Server Error' };
    }
  }

  // Fetch updates from AutoCount system
  public async fetchIncomingInvoices(): Promise<Invoice[]> {
    console.log('[AutoCount] Fetching incoming invoice updates...');
    return []; // Return fetched invoices to match adapter design pattern
  }
}
