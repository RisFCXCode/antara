import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  Clock,
  AlertTriangle,
  CircleDollarSign,
  Plus,
  X,
  Printer,
  Trash2,
  Tag,
  Save,
  User,
  Phone,
  MapPin,
  Mail,
  Layers,
  Edit2,
  CheckCircle,
  Truck
} from 'lucide-react';
import { BatikInvoice, BatikInvoiceItem } from '../db/database';

type PdfTheme = 'normal' | 'white';

const STATUS_COLORS: Record<string, string> = {
  paid:      'var(--accent-green)',
  pending:   'var(--accent-cyan)',
  draft:     'var(--text-muted)',
  cancelled: 'var(--accent-coral)'
};

// Available pre-registered fabrics for selection
const FABRIC_CATALOG = ['Dubai Cotton', 'Cotton Viscose'];

interface MonthlyInvoiceGroup {
  key: string;
  label: string;
  invoiceCount: number;
  receiptCount: number;
  total: number;
  invoices: BatikInvoice[];
}

function getInvoiceMonthGroup(invoice: BatikInvoice): { key: string; label: string } {
  const date = new Date(invoice.created_at);
  if (Number.isNaN(date.getTime())) {
    return { key: 'undated', label: 'Undated Documents' };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
  };
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<BatikInvoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<BatikInvoice | undefined>();
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [chartAgg, setChartAgg] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  // ── PDF Theme Picker Modal state ──
  const [themePickerInvoiceId, setThemePickerInvoiceId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const dbInvoices = await window.electronAPI.getInvoices();
      setInvoices(dbInvoices || []);
    } catch (err) {
      console.error('[Invoices] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Opens the theme picker — actual generation happens inside ThemePickerModal
  const handlePrintPdf = (id: string) => {
    setThemePickerInvoiceId(id);
  };

  const handleConfirmTheme = async (theme: PdfTheme) => {
    if (!themePickerInvoiceId) return;
    const id = themePickerInvoiceId;
    setThemePickerInvoiceId(null);
    setGeneratingPdf(true);
    showToast(`Generating ${theme === 'white' ? 'White' : 'Normal'} theme PDF…`);
    try {
      const res = await window.electronAPI.generateInvoicePdf(id, theme);
      if (res.success) {
        showToast('PDF successfully exported and opened!');
        loadInvoices();
      } else {
        showToast(`PDF generation failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (confirm(`Are you sure you want to delete invoice ${id}?`)) {
      try {
        const success = await window.electronAPI.deleteInvoice(id);
        if (success) {
          showToast(`Invoice ${id} deleted successfully.`);
          loadInvoices();
        } else {
          showToast(`Failed to delete invoice ${id}.`);
        }
      } catch (err: any) {
        showToast(`Error deleting: ${err.message}`);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const existingCustomers = useMemo(() => {
    const customersMap = new Map<string, { name: string; phone: string; email: string; address: string }>();
    invoices.forEach(inv => {
      if (inv.customer_name && inv.customer_phone) {
        const key = `${inv.customer_name}-${inv.customer_phone}`;
        if (!customersMap.has(key)) {
          customersMap.set(key, {
            name: inv.customer_name,
            phone: inv.customer_phone,
            email: inv.customer_email || '',
            address: inv.customer_address || ''
          });
        }
      }
    });
    return Array.from(customersMap.values());
  }, [invoices]);

  const handleMarkAsPaid = async (inv: BatikInvoice) => {
    try {
      const updatedInvoice = { ...inv, status: 'paid' as const };
      await window.electronAPI.saveInvoice(updatedInvoice);
      showToast(`Invoice ${inv.id} marked as paid.`);
      loadInvoices();
    } catch (err: any) {
      showToast(`Error marking as paid: ${err.message}`);
    }
  };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const monthlyInvoiceGroups = useMemo<MonthlyInvoiceGroup[]>(() => {
    const groups = new Map<string, MonthlyInvoiceGroup>();
    const sortedInvoices = [...filtered].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    sortedInvoices.forEach(inv => {
      const { key, label } = getInvoiceMonthGroup(inv);
      const group = groups.get(key) || {
        key,
        label,
        invoiceCount: 0,
        receiptCount: 0,
        total: 0,
        invoices: []
      };

      if (inv.status === 'paid') {
        group.receiptCount += 1;
      } else {
        group.invoiceCount += 1;
      }

      group.total += inv.total || 0;
      group.invoices.push(inv);
      groups.set(key, group);
    });

    return Array.from(groups.values());
  }, [filtered]);
  
  // Calculate summary values
  const activeInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'pending');
  const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <>
    {/* ── PDF Theme Picker Modal ── */}
    {themePickerInvoiceId && (
      <ThemePickerModal
        invoiceId={themePickerInvoiceId}
        onConfirm={handleConfirmTheme}
        onCancel={() => setThemePickerInvoiceId(null)}
      />
    )}
    <div className="animate-in subpage-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 1000,
          background: 'rgba(26, 20, 16, 0.95)',
          border: '1.5px solid var(--accent-amber)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          color: '#f5f1ed',
          padding: '14px 24px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animation: 'fadeUp 0.3s ease both',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}>
          <FileCheck size={16} style={{ color: 'var(--text-primary)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Revenue Performance Chart (Liquid Glass) */}
      <div 
        className="screenshot-card" 
        style={{ 
          marginBottom: 28, 
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 24,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 40px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.01em', marginBottom: 6 }}>Total revenue performance</div>
            <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 14 }}>
              RM {totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              <div style={{ 
                fontSize: 11.5, 
                padding: '5px 12px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                color: 'var(--text-secondary)', 
                borderRadius: '99px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>↑</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>12.4%</strong> vs Yesterday</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 99, border: '1px solid rgba(255,255,255,0.05)' }}>
            {['Daily', 'Weekly', 'Monthly'].map((t) => (
              <button 
                key={t}
                onClick={() => setChartAgg(t as 'Daily' | 'Weekly' | 'Monthly')}
                style={{ 
                  background: chartAgg === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  color: chartAgg === t ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '6px 14px',
                  borderRadius: '99px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: chartAgg === t ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)' : 'none'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Minimal Liquid Glass SVG Line Chart */}
        <div style={{ width: '100%', height: 160, position: 'relative', zIndex: 2 }}>
          {/* Subtle horizontal grid lines */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 10%, rgba(255,255,255,0.03) 90%, rgba(255,255,255,0) 100%)' }} />
            ))}
          </div>
          
          <svg width="100%" height="140" viewBox="0 0 800 140" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" stopOpacity="1" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity="1" />
              </linearGradient>
            </defs>
            
            {/* Subtle area fill underneath the curve */}
            <path 
              d="M0,110 C100,105 150,125 250,85 C350,45 450,105 550,55 C650,5 700,35 800,15 L800,140 L0,140 Z" 
              fill="url(#lineGlow)" 
            />
            {/* Smooth bezier curve for data points */}
            <path 
              d="M0,110 C100,105 150,125 250,85 C350,45 450,105 550,55 C650,5 700,35 800,15" 
              fill="none" 
              stroke="rgba(255,255,255,0.25)" 
              strokeWidth="2.5" 
              style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
            />
          </svg>

          {/* Time axis labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '0 10px', position: 'relative' }}>
            {(chartAgg === 'Daily' 
              ? ['18 May', '19 May', '20 May', '21 May', '22 May'] 
              : chartAgg === 'Weekly' 
                ? ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'] 
                : ['Jan', 'Feb', 'Mar', 'Apr', 'May']).map(label => (
              <div key={label} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em' }}>{label}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="screenshot-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Batik Sales Invoices</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage client orders, review quantity discount tiers, and print custom-branded receipts.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="screenshot-select" style={{ width: 140, padding: '8px 12px', fontSize: 12 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Documents</option>
              <option value="pending">Invoice</option>
              <option value="paid">Receipt</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="verify-btn-style" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setEditingInvoice(undefined); setShowForm(!showForm); }}>
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Close Editor' : 'New Invoice'}
            </button>
          </div>
        </div>

        {showForm && (
          <NewInvoiceForm 
            initialInvoice={editingInvoice}
            existingCustomers={existingCustomers}
            onClose={() => setShowForm(false)} 
            onSuccess={(pendingPdfId?: string) => {
              setShowForm(false);
              loadInvoices();
              if (pendingPdfId) {
                // Open theme picker so user can choose PDF style
                setThemePickerInvoiceId(pendingPdfId);
              } else {
                showToast('Invoice saved successfully.');
              }
            }} 
            showToast={showToast}
          />
        )}

        <div className="screenshot-table-wrap">
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Batik registry…</div>
          ) : (
            <table className="screenshot-table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Customer</th>
                  <th>Contact Phone</th>
                  <th>Issue Date</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>Grand Total</th>
                  <th>Document Type</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthlyInvoiceGroups.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No invoices found matching current filter.</td>
                  </tr>
                ) : (
                  monthlyInvoiceGroups.map(group => (
                    <React.Fragment key={group.key}>
                      <tr>
                        <td colSpan={9} style={{ padding: '18px 0 10px', borderBottom: 'none' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16,
                            padding: '11px 16px',
                            background: 'rgba(255, 255, 255, 0.035)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 0,
                            color: 'var(--text-primary)'
                          }}>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>{group.label}</span>
                            <span className="action-pill-btn" style={{ cursor: 'default', marginRight: 12 }}>
                              RM {group.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.invoices.map(inv => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--accent-cyan)' }}>
                            {inv.status === 'paid' ? inv.id.replace(/^INV-/, 'REC-') : inv.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{inv.customer_name}</td>
                          <td className="text-secondary" style={{ fontFamily: 'var(--font-display)', fontSize: 12.5 }}>{inv.customer_phone}</td>
                          <td className="text-secondary" style={{ fontSize: 12.5 }}>{new Date(inv.created_at).toLocaleDateString('en-MY')}</td>
                          <td className="text-secondary">RM {inv.subtotal.toFixed(2)}</td>
                          <td className="text-secondary" style={{ color: inv.discount_amount > 0 ? 'var(--accent-amber)' : 'inherit' }}>
                            {inv.discount_amount > 0 ? `-RM ${inv.discount_amount.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>RM {inv.total.toFixed(2)}</td>
                          <td>
                            <span style={{ 
                              fontWeight: 600, 
                              color: 'var(--text-primary)', 
                              textTransform: 'capitalize',
                              padding: '5px 12px',
                              borderRadius: '9999px',
                              fontSize: 11.5,
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              backdropFilter: 'blur(12px)',
                              WebkitBackdropFilter: 'blur(12px)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              letterSpacing: '0.01em'
                            }}>
                              {inv.status === 'paid' ? 'Receipt' : inv.status === 'pending' ? 'Invoice' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <button 
                                  className="search-circle" 
                                  style={{ 
                                    width: 28, height: 28, 
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                                  }} 
                                  title="Mark as Paid"
                                  onClick={() => handleMarkAsPaid(inv)}
                                >
                                  <CheckCircle size={12} style={{ color: 'var(--accent-green)' }} />
                                </button>
                              )}
                              <button 
                                className="search-circle" 
                                style={{ 
                                  width: 28, height: 28, 
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  backdropFilter: 'blur(8px)',
                                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                                }} 
                                title="Edit Document"
                                onClick={() => { setEditingInvoice(inv); setShowForm(true); }}
                              >
                                <Edit2 size={12} style={{ color: 'var(--text-muted)' }} />
                              </button>
                              <button 
                                className="search-circle" 
                                style={{ 
                                  width: 28, height: 28, 
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  backdropFilter: 'blur(8px)',
                                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                                }} 
                                title="Print / Open Branded PDF"
                                onClick={() => handlePrintPdf(inv.id)}
                              >
                                <Printer size={12} style={{ color: 'var(--text-primary)' }} />
                              </button>
                              <button 
                                className="search-circle" 
                                style={{ 
                                  width: 28, height: 28, 
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  backdropFilter: 'blur(8px)',
                                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                                }} 
                                title="Delete Invoice"
                                onClick={() => handleDeleteInvoice(inv.id)}
                              >
                                <Trash2 size={12} style={{ color: 'var(--text-muted)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

interface NewInvoiceFormProps {
  onClose: () => void;
  onSuccess: (pendingPdfId?: string) => void;
  showToast: (msg: string) => void;
  initialInvoice?: BatikInvoice;
  existingCustomers?: { name: string; phone: string; email: string; address: string }[];
}

function NewInvoiceForm({ onClose, onSuccess, showToast, initialInvoice, existingCustomers = [] }: NewInvoiceFormProps) {
  const [ref, setRef] = useState(initialInvoice?.id || `INV-2026-${Math.floor(Math.random() * 9000) + 1000}`);
  const [customerName, setCustomerName] = useState(initialInvoice?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(initialInvoice?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(initialInvoice?.customer_email || '');
  const [customerAddress, setCustomerAddress] = useState(initialInvoice?.customer_address || '');
  const [status, setStatus] = useState<'draft' | 'paid' | 'pending'>(
    (initialInvoice?.status as 'draft' | 'paid' | 'pending') || 'pending'
  );
  
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'none'>(
    initialInvoice?.discount_type || 'none'
  );
  const [discountValue, setDiscountValue] = useState(initialInvoice?.discount_value || 0);
  const [shippingCost, setShippingCost] = useState(initialInvoice?.shipping_cost || 0);

  // Line items state
  const [items, setItems] = useState<Omit<BatikInvoiceItem, 'id' | 'total'>[]>(
    initialInvoice?.items || [
      { fabric_type: 'Dubai Cotton', pattern_name: '', quantity_meters: 10, price_per_meter: 40.00 }
    ]
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<number, boolean>>(
    initialInvoice?.items.reduce((acc, item, idx) => {
      if (item.size_breakdown && item.size_breakdown.length > 0) {
        acc[idx] = true;
      }
      return acc;
    }, {} as Record<number, boolean>) || {}
  );

  const handleToggleBreakdown = (index: number) => {
    setExpandedBreakdowns(prev => ({ ...prev, [index]: !prev[index] }));
    const updatedItems = [...items];
    if (!updatedItems[index].size_breakdown) {
      updatedItems[index].size_breakdown = [];
      setItems(updatedItems);
    }
  };

  const handleAddSize = (index: number) => {
    const updatedItems = [...items];
    const bd = updatedItems[index].size_breakdown || [];
    updatedItems[index].size_breakdown = [...bd, 0];
    setItems(updatedItems);
  };

  const handleUpdateSize = (index: number, sizeIdx: number, val: number) => {
    const updatedItems = [...items];
    const bd = [...(updatedItems[index].size_breakdown || [])];
    bd[sizeIdx] = val;
    updatedItems[index].size_breakdown = bd;
    setItems(updatedItems);
  };

  const handleRemoveSize = (index: number, sizeIdx: number) => {
    const updatedItems = [...items];
    const bd = [...(updatedItems[index].size_breakdown || [])];
    bd.splice(sizeIdx, 1);
    updatedItems[index].size_breakdown = bd;
    setItems(updatedItems);
  };

  // Auto calculate tier-based unit price whenever quantity changes
  const handleQuantityChange = async (index: number, valStr: string) => {
    const qty = parseFloat(valStr) || 0;
    const updatedItems = [...items];
    updatedItems[index].quantity_meters = qty;

    try {
      // Query Electron Main Process for Tier Pricing Calculation!
      const res = await window.electronAPI.calculateTierPrice(qty);
      if (res && typeof res.price === 'number') {
        updatedItems[index].price_per_meter = res.price;
      }
    } catch (err) {
      // Fallback
      if (qty >= 1000) updatedItems[index].price_per_meter = 35;
      else if (qty >= 500) updatedItems[index].price_per_meter = 37;
      else if (qty >= 100) updatedItems[index].price_per_meter = 38;
      else updatedItems[index].price_per_meter = 40;
    }

    setItems(updatedItems);
  };

  const handleItemFieldChange = (index: number, key: string, val: any) => {
    const updatedItems = [...items];
    (updatedItems[index] as any)[key] = val;
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([...items, { fabric_type: 'Dubai Cotton', pattern_name: '', quantity_meters: 10, price_per_meter: 40.00 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Calculates subtotal, discount, grand total dynamically
  const subtotal = items.reduce((sum, item) => sum + (item.quantity_meters * item.price_per_meter), 0);
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = subtotal * (discountValue / 100);
  } else if (discountType === 'fixed') {
    discountAmount = discountValue;
  }
  discountAmount = Math.min(discountAmount, subtotal); // Prevent negative grand totals
  const grandTotal = subtotal - discountAmount + shippingCost;

  const handleSubmit = async () => {
    if (!customerName || !customerPhone) {
      setErrorMsg('Please specify Customer Name and Contact Phone.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      // Map complete items with id and calculated totals
      const completeItems: BatikInvoiceItem[] = items.map((item, idx) => ({
        id: `ii-${idx}-${Math.floor(Math.random()*1000)}`,
        fabric_type: item.fabric_type,
        pattern_name: item.pattern_name,
        quantity_meters: item.quantity_meters,
        size_breakdown: item.size_breakdown && item.size_breakdown.length > 0 ? item.size_breakdown : undefined,
        price_per_meter: item.price_per_meter,
        total: item.quantity_meters * item.price_per_meter
      }));

      const newInvoice: BatikInvoice = {
        id: ref,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || undefined,
        customer_address: customerAddress || undefined,
        items: completeItems,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        shipping_cost: shippingCost,
        total: grandTotal,
        status,
        created_at: new Date().toISOString()
      };

      // 1. Save new invoice record to local JSON DB
      await window.electronAPI.saveInvoice(newInvoice);

      // 2. For paid receipts: signal parent to open theme picker for PDF
      //    For drafts/pending: just save silently
      if (status === 'paid') {
        onSuccess(ref);  // parent opens ThemePickerModal
      } else {
        onSuccess();     // no PDF needed yet
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'System failure saving invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screenshot-card" style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      padding: 24,
      marginBottom: 24,
    }}>
      <div className="card-title-lg" style={{ fontSize: 16, marginBottom: 14 }}>Create Sales Order Invoice</div>
      
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 18 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Customer Selection */}
      {existingCustomers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <select 
            className="screenshot-input" 
            style={{ width: '100%', padding: '10px 14px', appearance: 'auto' }}
            onChange={(e) => {
              const selected = existingCustomers.find(c => `${c.name}-${c.phone}` === e.target.value);
              if (selected) {
                setCustomerName(selected.name);
                setCustomerPhone(selected.phone);
                setCustomerEmail(selected.email);
                setCustomerAddress(selected.address);
              }
            }}
          >
            <option value="">-- Select Existing Customer (Optional) --</option>
            {existingCustomers.map(c => (
              <option key={`${c.name}-${c.phone}`} value={`${c.name}-${c.phone}`}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Customer Info Form Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={12} />
              Customer Name *
            </label>
            <input className="screenshot-input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Synergy Fashion Sdn Bhd" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={12} />
              Contact Phone *
            </label>
            <input className="screenshot-input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="60124445555" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={12} />
              Email Address
            </label>
            <input className="screenshot-input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="buyer@designhouse.my" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group" style={{ height: '100%' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={12} />
              Billing & Delivery Address
            </label>
            <textarea 
              className="screenshot-input" 
              style={{ height: 'calc(100% - 24px)', minHeight: 92, resize: 'none', padding: '10px 14px' }} 
              value={customerAddress} 
              onChange={e => setCustomerAddress(e.target.value)} 
              placeholder="No. 42, Jalan Bukit Bintang, 55100 WP Kuala Lumpur, Malaysia"
            />
          </div>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Order Reference ID</label>
          <input className="screenshot-input" value={ref} onChange={e => setRef(e.target.value)} placeholder="INV-2026-0001" style={{ fontFamily: 'var(--font-display)', fontWeight: 'bold' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Document Type</label>
          <select className="screenshot-select" value={status} onChange={e => {
            const newStatus = e.target.value as any;
            setStatus(newStatus);
            if (newStatus === 'paid') setRef(prev => prev.replace(/^INV-/, 'REC-'));
            else if (newStatus === 'pending') setRef(prev => prev.replace(/^REC-/, 'INV-'));
          }}>
            <option value="pending">Invoice</option>
            <option value="paid">Receipt</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Fabric Line Items Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Fabric Roll Items</span>
          <button className="search-circle" style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.04)' }} title="Add Item Row" onClick={handleAddItem}>
            <Plus size={14} />
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', background: 'none', borderBottom: 'none' }}>Batik Fabric Material</th>
              <th style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', background: 'none', borderBottom: 'none', width: '20%' }}>Quantity (m)</th>
              <th style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', background: 'none', borderBottom: 'none', width: '20%' }}>Unit Price</th>
              <th style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', background: 'none', borderBottom: 'none', width: '20%', textAlign: 'right' }}>Total (RM)</th>
              <th style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', background: 'none', borderBottom: 'none', width: '8%', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <React.Fragment key={index}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 4px' }}>
                    <select 
                      className="screenshot-select" 
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12 }}
                      value={item.fabric_type}
                      onChange={e => handleItemFieldChange(index, 'fabric_type', e.target.value)}
                    >
                      {FABRIC_CATALOG.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <button 
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: 10, cursor: 'pointer', padding: '4px 0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleToggleBreakdown(index)}
                    >
                      <Layers size={10} />
                      {expandedBreakdowns[index] ? 'Hide Cuts' : 'Add Cut Breakdown'}
                    </button>
                  </td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>
                    <input 
                      className="screenshot-input" 
                      type="number" 
                      style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-display)', marginTop: 2 }}
                      value={item.quantity_meters || ''} 
                      onChange={e => handleQuantityChange(index, e.target.value)}
                      placeholder="0.0m" 
                    />
                  </td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 12, padding: '8px 10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, fontFamily: 'var(--font-display)', marginTop: 2 }}>
                      RM {item.price_per_meter.toFixed(2)}
                    </div>
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--accent-cyan)', verticalAlign: 'top', paddingTop: 16 }}>
                    RM {(item.quantity_meters * item.price_per_meter).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'top', paddingTop: 14 }}>
                    <button 
                      className="search-circle" 
                      type="button"
                      style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.02)', margin: '0 auto' }}
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length <= 1}
                    >
                      <X size={12} style={{ color: 'var(--accent-coral)' }} />
                    </button>
                  </td>
                </tr>
                {expandedBreakdowns[index] && (
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td colSpan={5} style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cut Size Breakdown (Optional)</span>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => handleAddSize(index)}>+ Add Cut Size</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(item.size_breakdown || []).map((size, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <input 
                                type="number" 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: 40, fontSize: 11, outline: 'none', fontFamily: 'var(--font-display)' }} 
                                value={size || ''} 
                                onChange={e => handleUpdateSize(index, sIdx, parseFloat(e.target.value) || 0)}
                                placeholder="0.0"
                              />
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 6 }}>m</span>
                              <button type="button" style={{ background: 'transparent', border: 'none', color: 'var(--accent-coral)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }} onClick={() => handleRemoveSize(index, sIdx)}>
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          {(!item.size_breakdown || item.size_breakdown.length === 0) && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No cuts specified.</div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Discount & Totals Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={12} />
              Discount Adjustments
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select 
                className="screenshot-select" 
                style={{ width: '40%', padding: '8px 12px', fontSize: 12 }}
                value={discountType}
                onChange={e => {
                  setDiscountType(e.target.value as any);
                  setDiscountValue(0);
                }}
              >
                <option value="none">No Discount</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Rate (RM)</option>
              </select>
              {discountType !== 'none' && (
                <input 
                  className="screenshot-input" 
                  type="number" 
                  style={{ width: '60%', padding: '8px 12px', fontSize: 12 }}
                  value={discountValue || ''} 
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder={discountType === 'percentage' ? 'e.g. 5%' : 'e.g. 150.00'} 
                />
              )}
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Truck size={12} />
              Shipping Cost
            </label>
            <input 
              className="screenshot-input" 
              type="number" 
              style={{ width: '100%', padding: '8px 12px', fontSize: 12 }}
              value={shippingCost || ''} 
              onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 15.00" 
            />
          </div>
          
          <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, lineHeight: 1.4 }}>
            <strong>Tier Pricing Rules Applied:</strong> Quantity discounts are checked per fabric row. &lt;100m is RM 40, &ge;100m is RM 38, &ge;500m is RM 37, and &ge;1000m is RM 35.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '70%', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>RM {subtotal.toFixed(2)}</span>
          </div>
          {discountType !== 'none' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '70%', fontSize: 12, color: 'var(--accent-amber)' }}>
              <span>Deductions:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>- RM {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {shippingCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '70%', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Shipping:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>RM {shippingCost.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '70%', fontSize: 14, fontWeight: 'bold', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: 10, marginTop: 4 }}>
            <span style={{ color: 'var(--accent-amber)' }}>Grand Total:</span>
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)' }}>RM {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="action-pill-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '⏳ Saving Order…' : status === 'paid' ? 'Generate & Print PDF' : 'Save Invoice'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemePickerModal — appears before any PDF export so user selects a theme
// ─────────────────────────────────────────────────────────────────────────────
interface ThemePickerModalProps {
  invoiceId: string;
  onConfirm: (theme: PdfTheme) => void;
  onCancel: () => void;
}

function ThemePickerModal({ invoiceId, onConfirm, onCancel }: ThemePickerModalProps) {
  const [hovered, setHovered] = useState<PdfTheme | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const themes: Array<{
    id: PdfTheme;
    label: string;
    tagline: string;
    swatches: string[];
    badge: string;
  }> = [
    {
      id: 'normal',
      label: 'Normal',
      tagline: 'Dark luxury · Liquid glass · Branded identity',
      swatches: ['#1a1410', '#cfab6d', '#2a2420', '#3a3430'],
      badge: 'Default',
    },
    {
      id: 'white',
      label: 'White',
      tagline: 'Clean corporate · Minimal · Print-optimised',
      swatches: ['#ffffff', '#1a1a2e', '#f5f5f5', '#e8e8e8'],
      badge: 'Corporate',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.60)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeUp 0.22s ease both',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--glass-bg-elevated)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 22,
          padding: '30px 26px 22px',
          width: 500, maxWidth: '92vw',
          boxShadow: '0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: 99, padding: '4px 14px', marginBottom: 10,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const, color: 'var(--text-primary)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)'
            }}>
              PDF Export
            </div>
            <div style={{
              fontSize: 19, fontFamily: 'var(--font-display)',
              fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4,
            }}>
              Choose PDF Theme
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Select the visual style for{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invoiceId}</span>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 9, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Theme Cards Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {themes.map(theme => {
            const isHov = hovered === theme.id;
            return (
              <button
                key={theme.id}
                onMouseEnter={() => setHovered(theme.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onConfirm(theme.id)}
                style={{
                  background: isHov ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
                  border: isHov
                    ? '1.5px solid rgba(255,255,255,0.3)'
                    : '1.5px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '16px 14px',
                  cursor: 'pointer', textAlign: 'left' as const,
                  display: 'flex', flexDirection: 'column', gap: 12,
                  transition: 'all 0.18s ease',
                  transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHov
                    ? `0 12px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`
                    : 'none',
                }}
              >
                {/* Colour swatches */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {theme.swatches.map((c, i) => (
                    <div key={i} style={{
                      flex: i === 0 ? 2 : 1, height: 26, borderRadius: 5,
                      background: c, border: '1px solid rgba(0,0,0,0.15)',
                    }} />
                  ))}
                </div>

                {/* Name + Tagline */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {theme.label}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {theme.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Footer hint ── */}
        <div style={{
          fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center' as const,
          paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          Click a theme to generate &amp; open your PDF &nbsp;·&nbsp; Press{' '}
          <kbd style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: '1px 6px', fontSize: 9.5,
          }}>Esc</kbd>{' '}
          or click outside to cancel
        </div>
      </div>
    </div>
  );
}
