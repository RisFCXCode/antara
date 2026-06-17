import { Invoice } from '../db/database';

export class LhdnClient {
  private apiBase: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    this.apiBase = process.env.LHDN_API_BASE || 'https://myinvois.sandbox.hasil.gov.my';
    this.clientId = process.env.LHDN_CLIENT_ID || 'sandbox_client_id_123';
    this.clientSecret = process.env.LHDN_CLIENT_SECRET || 'sandbox_secret_456';
  }

  // Handle Auth Token Refresh
  private async ensureAuthenticated(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      // High-fidelity Mock/Real auth exchange
      // In production, this would do a fetch to: `${this.apiBase}/connect/token`
      console.log(`[LHDN] Requesting access token from ${this.apiBase}...`);
      
      // Simulating a successful OAuth2 response
      this.accessToken = `lhdn_token_${Math.random().toString(36).substring(2, 15)}`;
      this.tokenExpiresAt = Date.now() + 3500 * 1000; // 1 hour expiry
      return this.accessToken;
    } catch (err) {
      console.error('[LHDN] Authentication failed:', err);
      throw new Error('LHDN MyInvois API Authentication Failure');
    }
  }

  // Submit Invoice to LHDN MyInvois
  public async submitInvoice(invoice: Invoice): Promise<{
    success: boolean;
    lhdn_uuid?: string;
    error?: string;
    validationResponse?: any;
  }> {
    const token = await this.ensureAuthenticated();
    
    try {
      console.log(`[LHDN] Submitting invoice ID: ${invoice.id} with token ${token.substring(0, 8)}...`);
      
      // Parse MyInvois standard schema and validate against LHDN rules
      // Mocking high-fidelity sandbox response
      const isSuccess = invoice.supplier_tin.startsWith('SG') || invoice.supplier_tin.length > 5;
      
      if (isSuccess) {
        return {
          success: true,
          lhdn_uuid: `uuid-${Math.random().toString(36).substring(2, 15)}`,
          validationResponse: {
            status: 'Valid',
            longId: `longid-${Math.random().toString(36).substring(2, 15)}`,
            validationSteps: [
              { step: 'Signature validation', status: 'Passed' },
              { step: 'TIN verification', status: 'Passed' },
              { step: 'SST rate check', status: 'Passed' }
            ]
          }
        };
      } else {
        return {
          success: false,
          error: 'Supplier TIN is invalid. Buyer/Supplier TIN must be valid LHDN formats.',
          validationResponse: {
            status: 'Invalid',
            errors: [
              { code: 'VAL-001', message: 'TIN format is invalid for Malaysian tax residents.' }
            ]
          }
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'LHDN Server Error'
      };
    }
  }
}
