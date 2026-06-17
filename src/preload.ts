import { contextBridge, ipcRenderer } from 'electron';

// Expose safe API to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  resizeWindow: (size: { width: number; height: number }) => 
    ipcRenderer.invoke('window:resize', size),

  // ==========================================
  // MODULE 1: INVOICE & RECEIPT GENERATION
  // ==========================================
  getInvoices: () => ipcRenderer.invoke('invoice:get-all'),
  getInvoiceById: (id: string) => ipcRenderer.invoke('invoice:get-by-id', id),
  saveInvoice: (invoice: any) => ipcRenderer.invoke('invoice:save', invoice),
  deleteInvoice: (id: string) => ipcRenderer.invoke('invoice:delete', id),
  calculateTierPrice: (meters: number) => ipcRenderer.invoke('invoice:calculate-tier-price', meters),
  generateInvoicePdf: (id: string, theme?: 'normal' | 'white') =>
    ipcRenderer.invoke('invoice:generate-pdf', { invoiceId: id, theme: theme ?? 'normal' }),

  // ==========================================
  // MODULE 2: LEAD INTELLIGENCE
  // ==========================================
  getLeads: () => ipcRenderer.invoke('leads:get-all'),
  getLeadById: (id: string) => ipcRenderer.invoke('leads:get-by-id', id),
  saveLead: (lead: any) => ipcRenderer.invoke('leads:save', lead),
  deleteLead: (id: string) => ipcRenderer.invoke('leads:delete', id),
  scoreLead: (lead: any) => ipcRenderer.invoke('leads:score', lead),
  generateLeads: (location: string, industry: string) => ipcRenderer.invoke('leads:generate', location, industry),
  onLeadGenerationProgress: (callback: (msg: string) => void) => {
    ipcRenderer.on('leads:generate-progress', (_event, msg) => callback(msg));
  },
  removeLeadGenerationProgressListener: () => {
    ipcRenderer.removeAllListeners('leads:generate-progress');
  },

  // ==========================================
  // MODULE 3: INVENTORY MANAGEMENT
  // ==========================================
  getInventory: () => ipcRenderer.invoke('inventory:get-all'),
  saveInventoryItem: (item: any) => ipcRenderer.invoke('inventory:save', item),
  deleteInventoryItem: (id: string) => ipcRenderer.invoke('inventory:delete', id),

  // ==========================================
  // MODULE 4: PROJECT MATERIAL ALLOCATIONS
  // ==========================================
  getProjects: () => ipcRenderer.invoke('project:get-all'),
  saveProject: (project: any) => ipcRenderer.invoke('project:save', project),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // ==========================================
  // SYSTEM / AUDIT
  // ==========================================
  getAuditLogs: () => ipcRenderer.invoke('audit:get-logs'),
});
