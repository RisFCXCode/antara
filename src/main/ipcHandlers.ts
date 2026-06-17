import { ipcMain } from 'electron';
import { Database, BatikInvoice, TailorContact, InventoryItem, ProjectAllocation, getPricePerMeter } from '../db/database';
import { InvoicePdfService, PdfTheme } from '../services/invoice-pdf.service';
import { generateLeads } from './LeadGenerator';

// ==========================================
// EXPORTED LOGIC
// ==========================================
export function scoreLeadLogic(lead: any) {
    // We now use Gemini's contextual procurement confidence (1-100) as the base score
    let baseScore = typeof lead.data_confidence === 'number' ? lead.data_confidence : 30;
    
    // Scale Heuristic Bonus
    const emp = lead.employee_count || 0;
    if (emp >= 1000) baseScore += 15;
    else if (emp >= 500) baseScore += 10;
    else if (emp >= 100) baseScore += 5;

    // Corporate Registration Bonus
    const reg = lead.registration_type?.toLowerCase() || '';
    if (reg.includes('bhd') && !reg.includes('sdn')) baseScore += 10;
    else if (reg.includes('sdn bhd')) baseScore += 5;
    
    if (lead.ssm_number) baseScore += 10; // Explicit Verification

    // High-Value Target (HVT) Matrix Multiplier
    let dataMultiplier = 1.0;
    let presenceBoost = 0;

    if (lead.email) dataMultiplier += 0.1;
    if (lead.decision_maker) dataMultiplier += 0.3; // Found a direct contact name

    if (lead.linkedin_url) presenceBoost += 8;
    if (lead.facebook_url) presenceBoost += 4;
    if (lead.website) presenceBoost += 3;

    let finalScore = Math.floor((baseScore * dataMultiplier) + presenceBoost);
    finalScore = Math.min(finalScore, 99); // Max score 99
    
    // Minimum floor
    if (finalScore < 10) finalScore = 10;

    let tier = 'D';
    if (finalScore >= 80) tier = 'A';
    else if (finalScore >= 60) tier = 'B';
    else if (finalScore >= 40) tier = 'C';

    return { score: finalScore, tier };
}

export function registerIpcHandlers(): void {
  const db = Database.getInstance();
  const pdfService = new InvoicePdfService();

  ipcMain.handle('invoice:get-all', async () => {
    return db.getInvoices();
  });

  ipcMain.handle('invoice:get-by-id', async (_, id: string) => {
    return db.getInvoice(id);
  });

  ipcMain.handle('invoice:save', async (_, invoice: BatikInvoice) => {
    db.saveInvoice(invoice);
    return { success: true };
  });

  ipcMain.handle('invoice:delete', async (_, id: string) => {
    const success = db.deleteInvoice(id);
    return { success };
  });

  ipcMain.handle('invoice:calculate-tier-price', async (_, meters: number) => {
    const price = getPricePerMeter(meters);
    return { price };
  });

  /**
   * invoice:generate-pdf
   * Args: { invoiceId: string; theme?: PdfTheme }
   * theme defaults to 'normal' if not supplied (backwards-compatible)
   */
  ipcMain.handle('invoice:generate-pdf', async (_, { invoiceId, theme }: { invoiceId: string; theme?: PdfTheme }) => {
    const invoice = db.getInvoice(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    const selectedTheme: PdfTheme = theme || 'normal';
    const res = await pdfService.generateAndOpenInvoicePdf(invoice, true, selectedTheme);
    if (res.success && res.filePath) {
      invoice.pdf_path = res.filePath;
      db.saveInvoice(invoice);
      db.log('invoice', `Exported PDF for ${invoice.id} [theme: ${selectedTheme}]`, `Saved to: ${res.filePath}`);
    }
    return res;
  });

  // ==========================================
  // MODULE 2: LEAD INTELLIGENCE
  // ==========================================

  ipcMain.handle('leads:get-all', async () => {
    return db.getLeads();
  });

  ipcMain.handle('leads:get-by-id', async (_, id: string) => {
    return db.getLead(id);
  });

  ipcMain.handle('leads:save', async (_, lead: any) => {
    db.saveLead(lead);
    return { success: true };
  });

  ipcMain.handle('leads:delete', async (_, id: string) => {
    const success = db.deleteLead(id);
    return { success };
  });

  ipcMain.handle('leads:score', async (_, lead: any) => {
    return scoreLeadLogic(lead);
  });

  ipcMain.handle('leads:generate', async (event, location: string, industry: string) => {
    try {
      const generated = await generateLeads(location, industry, (msg) => {
        event.sender.send('leads:generate-progress', msg);
      });
      // Save all generated leads
      for (const lead of generated) {
        db.saveLead(lead);
      }
      return generated;
    } catch (err: any) {
      console.error('Lead Generation Error:', err);
      throw err;
    }
  });

  // ==========================================
  // MODULE 3: INVENTORY MANAGEMENT
  // ==========================================

  ipcMain.handle('inventory:get-all', async () => {
    return db.getInventory();
  });

  ipcMain.handle('inventory:save', async (_, item: InventoryItem) => {
    db.saveInventoryItem(item);
    return { success: true };
  });

  ipcMain.handle('inventory:delete', async (_, id: string) => {
    const success = db.deleteInventoryItem(id);
    return { success };
  });

  // ==========================================
  // MODULE 4: PROJECT MATERIAL ALLOCATIONS
  // ==========================================

  ipcMain.handle('project:get-all', async () => {
    return db.getProjects();
  });

  ipcMain.handle('project:save', async (_, project: ProjectAllocation) => {
    db.saveProject(project);
    return { success: true };
  });

  ipcMain.handle('project:delete', async (_, id: string) => {
    const success = db.deleteProject(id);
    return { success };
  });

  // ==========================================
  // SYSTEM / AUDIT
  // ==========================================

  ipcMain.handle('audit:get-logs', async () => {
    return db.getAuditLogs();
  });
}
