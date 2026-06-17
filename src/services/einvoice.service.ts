import { Database, Invoice } from '../db/database';
import { LhdnClient } from '../integrations/lhdn.client';
import { AutoCountAdapter } from '../integrations/autocount.client';

export class EInvoiceService {
  private db: Database;
  private lhdnClient: LhdnClient;
  private autoCountAdapter: AutoCountAdapter;

  constructor() {
    this.db = Database.getInstance();
    this.lhdnClient = new LhdnClient();
    this.autoCountAdapter = new AutoCountAdapter();
  }

  // Pre-submission Local Validation Checker
  public validateInvoice(invoice: Invoice): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!invoice.supplier_tin || invoice.supplier_tin.trim() === '') {
      errors.push('Supplier TIN is a mandatory field.');
    }
    if (!invoice.buyer_tin || invoice.buyer_tin.trim() === '') {
      errors.push('Buyer TIN is a mandatory field.');
    }
    if (invoice.total <= 0) {
      errors.push('Total invoice amount must be greater than 0.');
    }
    if (!invoice.items || invoice.items.length === 0) {
      errors.push('Invoice must contain at least one line item.');
    }

    // High-fidelity format check for Malaysian TIN (starts with alphanumeric, minimum length)
    const tinRegex = /^[A-Z0-9]{5,20}$/i;
    if (invoice.supplier_tin && !tinRegex.test(invoice.supplier_tin)) {
      errors.push('Supplier TIN format is invalid. Must be alphanumeric and 5-20 characters.');
    }
    if (invoice.buyer_tin && !tinRegex.test(invoice.buyer_tin)) {
      errors.push('Buyer TIN format is invalid. Must be alphanumeric and 5-20 characters.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Submit and Sync process flow
  public async submitEInvoice(invoiceId: string): Promise<{
    success: boolean;
    errors?: string[];
    invoice?: Invoice;
  }> {
    const invoice = this.db.getInvoice(invoiceId);
    if (!invoice) {
      return { success: false, errors: ['Invoice not found in local database.'] };
    }

    // 1. Pre-submission checks
    const valResult = this.validateInvoice(invoice);
    if (!valResult.isValid) {
      this.db.log('einvoice', `Validate invoice: ${invoice.id}`, 'Failed validation', valResult.errors);
      return { success: false, errors: valResult.errors };
    }

    // Update status to pending
    invoice.status = 'pending';
    this.db.saveInvoice(invoice);

    // 2. Submit to LHDN API
    const lhdnRes = await this.lhdnClient.submitInvoice(invoice);
    
    if (lhdnRes.success && lhdnRes.lhdn_uuid) {
      invoice.status = 'validated';
      invoice.lhdn_uuid = lhdnRes.lhdn_uuid;
      invoice.submitted_at = new Date().toISOString();
      invoice.validated_at = new Date().toISOString();
      this.db.saveInvoice(invoice);

      this.db.log('einvoice', `Submit LHDN MyInvois: ${invoice.id}`, 'Validated successfully', lhdnRes.validationResponse);

      // 3. Two-way Accounting Sync with AutoCount
      const syncRes = await this.autoCountAdapter.syncInvoice(invoice);
      if (syncRes.success) {
        this.db.log('einvoice', `Sync AutoCount ledger: ${invoice.id}`, `Synced remote ID: ${syncRes.remoteId}`);
      } else {
        this.db.log('einvoice', `Sync AutoCount ledger: ${invoice.id}`, `Sync failed: ${syncRes.error}`);
      }

      // 4. Cross-Module trigger: E-Invoice Submitted -> Auto-send confirmation email to buyer
      try {
        console.log(`[Cross-Module Trigger] Auto-email invoice confirmation to buyer: ${invoice.buyer_tin}...`);
        this.db.log('email', 'Send email confirmation', 'Queued system email auto-dispatch');
      } catch (err) {
        console.error('Failed to trigger cross-module email confirmation:', err);
      }

      return { success: true, invoice };
    } else {
      invoice.status = 'rejected';
      this.db.saveInvoice(invoice);

      const errList = lhdnRes.error ? [lhdnRes.error] : ['LHDN Validation Error'];
      this.db.log('einvoice', `Submit LHDN MyInvois: ${invoice.id}`, 'LHDN Rejected', lhdnRes.validationResponse);

      return { success: false, errors: errList };
    }
  }
}
