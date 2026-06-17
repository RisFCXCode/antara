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
