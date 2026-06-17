import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, BatikInvoice, Lead } from '../db/database';

export class SupabaseSyncService {
  private supabase: SupabaseClient | null = null;
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public init(url: string, key: string) {
    if (url && key) {
      this.supabase = createClient(url, key);
      console.log('✅ Supabase Sync Engine Initialized');
      this.runInitialSeedAndSync();
    } else {
      console.warn('⚠️ Supabase credentials missing. Running in local-only mode.');
    }
  }

  // One-time automated migration script to seed existing data into Supabase
  private async runInitialSeedAndSync() {
    if (!this.supabase) return;

    try {
      console.log('🔄 Checking Supabase connection and running seed/sync...');
      
      // 1. Seed existing local invoices to Supabase if missing
      const localInvoices = this.db.getInvoices();
      for (const inv of localInvoices) {
        // Upsert to ensure no duplicates
        await this.supabase.from('invoices').upsert(inv, { onConflict: 'id' });
      }

      // 2. Sync down new invoices created by the Vercel Offline Bot
      const { data: cloudInvoices, error } = await this.supabase.from('invoices').select('*');
      if (cloudInvoices && !error) {
        let pulledCount = 0;
        for (const cloudInv of cloudInvoices) {
          const existsLocal = this.db.getInvoices().some(i => i.id === cloudInv.id);
          if (!existsLocal) {
            this.db.saveInvoice(cloudInv);
            pulledCount++;
          }
        }
        if (pulledCount > 0) {
          console.log(`📥 Successfully pulled ${pulledCount} offline invoices from Cloud.`);
        }
      }

    } catch (e) {
      console.error('❌ Supabase Sync Failed:', e);
    }
  }
}
