import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// =====================================================
// ANTARA BATIK PRICING TIERS (Meter-Based)
// =====================================================
// Below 100 m     | RM 40.00
// 100 m and above | RM 38.00
// 500 m and above | RM 37.00
// 1,000 m and above| RM 35.00
export const PRICING_TIERS = [
  { threshold: 1000, price: 35.00, label: '1,000 m and above (Wholesale Tier 3)' },
  { threshold: 500, price: 37.00, label: '500 m and above (Wholesale Tier 2)' },
  { threshold: 100, price: 38.00, label: '100 m and above (Wholesale Tier 1)' },
  { threshold: 0, price: 40.00, label: 'Below 100 m (Retail Tier)' }
];

export function getPricePerMeter(meters: number): number {
  const tier = PRICING_TIERS.find(t => meters >= t.threshold);
  return tier ? tier.price : 40.00;
}

// =====================================================
// DATA MODELS & TYPES FOR BATIK BUSINESS
// =====================================================

export interface BatikInvoiceItem {
  id: string;
  fabric_type: string;  // e.g. Silk, Cotton, Crepe, Satin
  pattern_name: string; // e.g. Megamendung, Parang, Kawung, Sekar Jagad
  quantity_meters: number;
  size_breakdown?: number[]; // Optional list of specific cut sizes
  price_per_meter: number; // Tier-based auto calculated
  total: number; // quantity * price_per_meter
}

export interface BatikInvoice {
  id: string; // e.g. "INV-2026-0001"
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  items: BatikInvoiceItem[];
  subtotal: number; // sum of item totals
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number; // e.g. 10 for 10% or RM10
  discount_amount: number; // Calculated deduction
  total: number; // subtotal - discount_amount
  status: 'draft' | 'paid' | 'pending' | 'cancelled';
  created_at: string;
  pdf_path?: string;
}

export interface TailorContact {
  id: string;
  store_name: string;
  contact_name: string;
  contact_number: string; // For WhatsApp Integration
  status: 'active' | 'inactive' | 'pending';
  notes?: string;
}

export interface Lead {
  id: string;
  company_name: string;
  industry: string;
  sub_industry?: string;
  business_type?: string;
  registration_type?: string;
  ssm_number?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  decision_maker?: string;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  employee_count?: number;
  employee_range?: string;
  uniform_frequency?: string;
  estimated_order_min?: number;
  estimated_order_max?: number;
  lead_score: number;
  lead_tier: string;
  stage: string;
  source?: string;
  data_confidence: string;
  last_refreshed?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  job_title?: string;
  department?: string;
  phone?: string;
  email?: string;
  linkedin_url?: string;
  is_decision_maker: boolean;
  confidence: string;
  source?: string;
  created_at: string;
}

export interface Tender {
  id: string;
  title: string;
  issuer: string;
  reference_no?: string;
  portal?: string;
  portal_url?: string;
  published_date?: string;
  closing_date?: string;
  estimated_value?: number;
  status: string;
  keywords_matched?: string[];
  linked_lead_id?: string;
  is_bookmarked: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  fabric_type: string;
  pattern_name: string;
  meterage: number; // Current stock level in meters
  type: 'sample' | 'roll' | 'cut';
  low_stock_threshold: number; // Level to trigger visual alerts
}

export interface ProjectAllocation {
  id: string;
  project_name: string;
  tailor_id: string; // Linked to TailorContact.id
  fabric_type: string;
  pattern_name: string;
  allocated_meters: number;
  status: 'allocated' | 'dispatched' | 'completed' | 'cancelled';
  due_date: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  module: 'invoice' | 'sales' | 'whatsapp' | 'inventory' | 'project';
  action: string;
  payload_hash: string;
  result: string;
  timestamp: string;
}

// =====================================================
// LOCAL DATA STORAGE ENGINE (ATOMIC JSON FILE STORE)
// =====================================================

export class Database {
  private static instance: Database | null = null;
  private dbPath: string;
  private data: {
    invoices: BatikInvoice[];
    tailors: TailorContact[];
    inventory: InventoryItem[];
    projects: ProjectAllocation[];
    auditLogs: AuditLog[];
    leads: Lead[];
    lead_contacts: LeadContact[];
    tenders: Tender[];
    emails: EmailMessage[];
  };

  private constructor() {
    // Get application user data directory
    const userData = app ? app.getPath('userData') : '.';
    const dir = path.join(userData, 'db_batik');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbPath = path.join(dir, 'batik_local_db.json');
    this.data = {
      invoices: [],
      tailors: [],
      inventory: [],
      projects: [],
      auditLogs: [],
      leads: [],
      lead_contacts: [],
      tenders: [],
      emails: []
    };
    this.load();

    // Auto-migration: Map old legacy fabric names to the 2 official choices and clear design pattern names
    let migrated = false;
    this.data.inventory.forEach(item => {
      const typeLower = item.fabric_type.toLowerCase();
      if (typeLower !== 'dubai cotton' && typeLower !== 'cotton viscose') {
        item.fabric_type = (typeLower.includes('silk') || typeLower.includes('crepe') || typeLower.includes('satin') || typeLower.includes('viscose')) 
          ? 'Cotton Viscose' 
          : 'Dubai Cotton';
        migrated = true;
      }
      if (item.pattern_name !== '') {
        item.pattern_name = '';
        migrated = true;
      }
    });
    this.data.projects.forEach(p => {
      const typeLower = p.fabric_type.toLowerCase();
      if (typeLower !== 'dubai cotton' && typeLower !== 'cotton viscose') {
        p.fabric_type = (typeLower.includes('silk') || typeLower.includes('crepe') || typeLower.includes('satin') || typeLower.includes('viscose')) 
          ? 'Cotton Viscose' 
          : 'Dubai Cotton';
        migrated = true;
      }
      if (p.pattern_name !== '') {
        p.pattern_name = '';
        migrated = true;
      }
    });
    this.data.invoices.forEach(inv => {
      inv.items.forEach(item => {
        const typeLower = item.fabric_type.toLowerCase();
        if (typeLower !== 'dubai cotton' && typeLower !== 'cotton viscose') {
          item.fabric_type = (typeLower.includes('silk') || typeLower.includes('crepe') || typeLower.includes('satin') || typeLower.includes('viscose')) 
            ? 'Cotton Viscose' 
            : 'Dubai Cotton';
          migrated = true;
        }
        if (item.pattern_name !== '') {
          item.pattern_name = '';
          migrated = true;
        }
      });
    });
    if (migrated) {
      this.save();
    }

    this.seedIfEmpty();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // Load database from file
  private load(): void {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      } catch (err) {
        console.error('Failed to load Batik local DB, starting fresh:', err);
      }
    } else {
      this.save();
    }
  }

  // Transactional Atomic Write (Write to temp, then rename to guarantee no corruption)
  private save(): void {
    try {
      const tempPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('Failed to save Batik DB atomically:', err);
    }
  }

  // Seed sample data for demonstrating features and premium looks instantly
  private seedIfEmpty(): void {
    let modified = false;

    // Seed Tailors
    if (this.data.tailors.length === 0) {
      this.data.tailors = [
        { id: 't-1', store_name: 'Impian Batik Tailoring', contact_name: 'Encik Roslan', contact_number: '60123456789', status: 'active', notes: 'Specializes in men\'s formal shirts.' },
        { id: 't-2', store_name: 'Sutra Indah Boutique', contact_name: 'Puan Aminah', contact_number: '60198765432', status: 'active', notes: 'Excellent for ladies\' baju kurung and silk kebaya.' },
        { id: 't-3', store_name: 'Warisan Heritage Fashion', contact_name: 'Abang Zulkifli', contact_number: '60133334444', status: 'pending', notes: 'Trialing high volume allocations.' },
        { id: 't-4', store_name: 'Anggun Atelier', contact_name: 'Sarah Tan', contact_number: '60177778888', status: 'active', notes: 'Premium modern custom dresses.' }
      ];
      modified = true;
    }

    // Seed Inventory (Exactly 2 items: Dubai Cotton & Cotton Viscose)
    if (this.data.inventory.length === 0) {
      this.data.inventory = [
        { id: 'i-1', fabric_type: 'Dubai Cotton', pattern_name: '', meterage: 1850, type: 'roll', low_stock_threshold: 300 },
        { id: 'i-2', fabric_type: 'Cotton Viscose', pattern_name: '', meterage: 645, type: 'roll', low_stock_threshold: 200 }
      ];
      modified = true;
    }

    // Seed Project Allocations
    if (this.data.projects.length === 0) {
      const today = new Date();
      const formatOffsetDate = (days: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() + days);
        return d.toISOString().split('T')[0];
      };

      this.data.projects = [
        { id: 'p-1', project_name: 'Hari Raya Corporate Shirts Batch A', tailor_id: 't-1', fabric_type: 'Dubai Cotton', pattern_name: '', allocated_meters: 350, status: 'dispatched', due_date: formatOffsetDate(5), created_at: formatOffsetDate(-10) },
        { id: 'p-2', project_name: 'KL Fashion Week Silk Gowns', tailor_id: 't-4', fabric_type: 'Dubai Cotton', pattern_name: '', allocated_meters: 120, status: 'allocated', due_date: formatOffsetDate(12), created_at: formatOffsetDate(-2) },
        { id: 'p-3', project_name: 'Wedding Entourage Kebaya Set', tailor_id: 't-2', fabric_type: 'Cotton Viscose', pattern_name: '', allocated_meters: 150, status: 'completed', due_date: formatOffsetDate(-3), created_at: formatOffsetDate(-15) }
      ];
      modified = true;
    }

    // Seed Invoices and Sales data
    if (this.data.invoices.length === 0) {
      const today = new Date();
      const formatOffsetDateStr = (days: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() + days);
        return d.toISOString();
      };

      this.data.invoices = [
        {
          id: 'INV-2026-0001',
          customer_name: 'Senandung Boutique Sdn Bhd',
          customer_phone: '60124445555',
          customer_email: 'procurement@senandung.com.my',
          customer_address: 'No. 24, Jalan Ampang, 50450 WP Kuala Lumpur',
          items: [
            { id: 'ii-1', fabric_type: 'Dubai Cotton', pattern_name: '', quantity_meters: 600, price_per_meter: 37.00, total: 22200 },
            { id: 'ii-2', fabric_type: 'Cotton Viscose', pattern_name: '', quantity_meters: 150, price_per_meter: 38.00, total: 5700 }
          ],
          subtotal: 27900,
          discount_type: 'percentage',
          discount_value: 5,
          discount_amount: 1395,
          total: 26505,
          status: 'paid',
          created_at: formatOffsetDateStr(-18)
        },
        {
          id: 'INV-2026-0002',
          customer_name: 'Mahkota Royal Attire',
          customer_phone: '60195556666',
          customer_email: 'dato.nasir@mahkota.my',
          customer_address: 'Lot 108, Bukit Bintang, 55100 WP Kuala Lumpur',
          items: [
            { id: 'ii-3', fabric_type: 'Dubai Cotton', pattern_name: '', quantity_meters: 120, price_per_meter: 38.00, total: 4560 }
          ],
          subtotal: 4560,
          discount_type: 'fixed',
          discount_value: 160,
          discount_amount: 160,
          total: 4400,
          status: 'paid',
          created_at: formatOffsetDateStr(-5)
        },
        {
          id: 'INV-2026-0003',
          customer_name: 'Mariani Couture House',
          customer_phone: '60132223333',
          customer_email: 'design@mariani.com',
          customer_address: '12-G, Jalan Gurney, 54000 WP Kuala Lumpur',
          items: [
            { id: 'ii-4', fabric_type: 'Dubai Cotton', pattern_name: '', quantity_meters: 1050, price_per_meter: 35.00, total: 36750 }
          ],
          subtotal: 36750,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          total: 36750,
          status: 'pending',
          created_at: formatOffsetDateStr(0)
        }
      ];
      modified = true;
    }

    if (modified) {
      this.save();
    }
  }



  // =====================================================
  // INVOICES CRUD METHODS
  // =====================================================
  public getInvoices(): BatikInvoice[] {
    return this.data.invoices;
  }

  public getInvoice(id: string): BatikInvoice | undefined {
    return this.data.invoices.find(inv => inv.id === id);
  }

  public saveInvoice(invoice: BatikInvoice): void {
    const idx = this.data.invoices.findIndex(inv => inv.id === invoice.id);
    if (idx >= 0) {
      this.data.invoices[idx] = invoice;
    } else {
      this.data.invoices.push(invoice);
    }
    this.save();
    this.log('invoice', `Saved invoice ${invoice.id}`, `Total: RM ${(invoice.total || 0).toFixed(2)}`);
  }

  public deleteInvoice(id: string): boolean {
    const startLen = this.data.invoices.length;
    this.data.invoices = this.data.invoices.filter(inv => inv.id !== id);
    if (this.data.invoices.length < startLen) {
      this.save();
      this.log('invoice', `Deleted invoice ${id}`, 'Success');
      return true;
    }
    return false;
  }

  // =====================================================
  // TAILOR CONTACTS CRUD METHODS
  // =====================================================
  public getTailors(): TailorContact[] {
    return this.data.tailors;
  }

  public getTailor(id: string): TailorContact | undefined {
    return this.data.tailors.find(t => t.id === id);
  }

  public saveTailor(tailor: TailorContact): void {
    const idx = this.data.tailors.findIndex(t => t.id === tailor.id);
    if (idx >= 0) {
      this.data.tailors[idx] = tailor;
    } else {
      this.data.tailors.push(tailor);
    }
    this.save();
    this.log('whatsapp', `Saved tailor ${tailor.store_name} (${tailor.id})`, `Status: ${tailor.status}`);
  }

  public deleteTailor(id: string): boolean {
    const initLen = this.data.tailors.length;
    this.data.tailors = this.data.tailors.filter(t => t.id !== id);
    if (this.data.tailors.length < initLen) {
      this.save();
      return true;
    }
    return false;
  }

  // =====================================
  // LEADS & TENDERS API
  // =====================================
  public getLeads(): Lead[] { return this.data.leads || []; }

  public getEmails(): EmailMessage[] {
    return this.data.emails || [];
  }

  public saveEmail(email: EmailMessage): void {
    const idx = this.data.emails.findIndex(e => e.id === email.id);
    if (idx >= 0) {
      this.data.emails[idx] = email;
    } else {
      this.data.emails.push(email);
    }
    this.save();
  }
  
  public getLead(id: string): Lead | undefined { 
    return (this.data.leads || []).find(l => l.id === id); 
  }
  
  public saveLead(lead: Lead): void {
    if (!this.data.leads) this.data.leads = [];
    const idx = this.data.leads.findIndex(l => l.id === lead.id);
    if (idx >= 0) {
      this.data.leads[idx] = lead;
    } else {
      this.data.leads.push(lead);
    }
    this.save();
  }
  
  public deleteLead(id: string): boolean {
    if (!this.data.leads) return false;
    const initLen = this.data.leads.length;
    this.data.leads = this.data.leads.filter(l => l.id !== id);
    if (this.data.leads.length < initLen) {
      this.save();
      return true;
    }
    return false;
  }

  // =====================================================
  // INVENTORY ITEMS CRUD METHODS
  // =====================================================
  public getInventory(): InventoryItem[] {
    return this.data.inventory;
  }

  public getInventoryItem(id: string): InventoryItem | undefined {
    return this.data.inventory.find(i => i.id === id);
  }

  public saveInventoryItem(item: InventoryItem): void {
    const idx = this.data.inventory.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      this.data.inventory[idx] = item;
    } else {
      this.data.inventory.push(item);
    }
    this.save();
    this.log('inventory', `Saved inventory item ${item.fabric_type} - ${item.pattern_name}`, `${item.meterage} meters`);
  }

  public deleteInventoryItem(id: string): boolean {
    const startLen = this.data.inventory.length;
    this.data.inventory = this.data.inventory.filter(i => i.id !== id);
    if (this.data.inventory.length < startLen) {
      this.save();
      this.log('inventory', `Deleted inventory item ${id}`, 'Success');
      return true;
    }
    return false;
  }

  // =====================================================
  // PROJECT ALLOCATIONS CRUD METHODS
  // =====================================================
  public getProjects(): ProjectAllocation[] {
    return this.data.projects;
  }

  public getProject(id: string): ProjectAllocation | undefined {
    return this.data.projects.find(p => p.id === id);
  }

  public saveProject(project: ProjectAllocation): void {
    const idx = this.data.projects.findIndex(p => p.id === project.id);
    const oldProject = idx >= 0 ? this.data.projects[idx] : null;

    if (idx >= 0) {
      this.data.projects[idx] = project;
    } else {
      this.data.projects.push(project);
    }

    // Adjust inventory if project is new or status changed
    if (!oldProject && project.status === 'dispatched') {
      this.adjustInventoryStock(project.fabric_type, project.pattern_name, -project.allocated_meters);
    } else if (oldProject && oldProject.status !== 'dispatched' && project.status === 'dispatched') {
      this.adjustInventoryStock(project.fabric_type, project.pattern_name, -project.allocated_meters);
    } else if (oldProject && oldProject.status === 'dispatched' && project.status === 'cancelled') {
      // Revert stock if project is cancelled
      this.adjustInventoryStock(project.fabric_type, project.pattern_name, project.allocated_meters);
    }

    this.save();
    this.log('project', `Saved project allocation ${project.project_name} (${project.id})`, `Status: ${project.status}`);
  }

  public deleteProject(id: string): boolean {
    const startLen = this.data.projects.length;
    const project = this.data.projects.find(p => p.id === id);

    this.data.projects = this.data.projects.filter(p => p.id !== id);
    if (this.data.projects.length < startLen) {
      // Revert stock if active and deleted
      if (project && project.status === 'dispatched') {
        this.adjustInventoryStock(project.fabric_type, project.pattern_name, project.allocated_meters);
      }
      this.save();
      this.log('project', `Deleted project allocation ${id}`, 'Success');
      return true;
    }
    return false;
  }

  private adjustInventoryStock(fabric: string, pattern: string, changeMeters: number): void {
    const item = this.data.inventory.find(
      i => i.fabric_type.toLowerCase() === fabric.toLowerCase() && i.pattern_name.toLowerCase() === pattern.toLowerCase()
    );
    if (item) {
      item.meterage = Math.max(0, item.meterage + changeMeters);
      this.log('inventory', `Auto adjusted stock for ${fabric} - ${pattern} by ${changeMeters}m due to project allocation`, `${item.meterage}m remaining`);
    }
  }

  // =====================================================
  // AUDIT LOGS CRUD METHODS
  // =====================================================
  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  public log(module: AuditLog['module'], action: string, result: string, payload?: any): void {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substring(2, 9),
      module,
      action,
      payload_hash: payload ? Math.random().toString(36).substring(2, 9) : '',
      result,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(newLog);
    this.save();
  }
}
