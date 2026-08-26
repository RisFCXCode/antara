import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  ShoppingBag,
  Plus,
  X,
  Save,
  CheckCircle2,
  DollarSign,
  Tag
} from 'lucide-react';
import { BatikInvoice, getPricePerMeter } from '../db/database';

const COST_PER_METER = 24;
const MONTHLY_PROFIT_GOAL = 15000;

interface SalesItem {
  id: string;
  invoiceId: string;
  customerName: string;
  date: string;
  fabricType: string;
  patternName: string;
  quantityMeters: number;
  pricePerMeter: number;
  itemTotal: number;
  itemCost: number;
  netProfit: number;
  status: string;
}

interface MonthlySalesGroup {
  key: string;
  label: string;
  totalSales: number;
  totalMeters: number;
  netProfit: number;
  sales: SalesItem[];
}

function getSalesMonthGroup(sale: SalesItem): { key: string; label: string } {
  const date = new Date(sale.date);
  if (Number.isNaN(date.getTime())) {
    return { key: 'undated', label: 'Undated Sales' };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
  };
}

export default function SalesTracking() {
  const [invoices, setInvoices] = useState<BatikInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWalkinForm, setShowWalkinForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Filters
  const [fabricFilter, setFabricFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all'); // all, wholesale (>= 100m), retail (<100m)

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getInvoices();
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices for sales tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compile all individual fabric item sales dynamically from all non-cancelled invoices
  const activeInvoices = invoices.filter(inv => inv.status === 'paid' || inv.status === 'pending');
  
  const salesItemsList: SalesItem[] = [];

  activeInvoices.forEach(inv => {
    const invoiceLineSubtotal = inv.items.reduce((sum, item) => {
      return sum + (item.total || item.quantity_meters * item.price_per_meter);
    }, 0);
    const invoiceGrandTotal = typeof inv.total === 'number' ? inv.total : invoiceLineSubtotal;

    inv.items.forEach(item => {
      const itemCost = item.quantity_meters * COST_PER_METER;
      const rawItemTotal = item.total || item.quantity_meters * item.price_per_meter;
      const itemTotal = invoiceLineSubtotal > 0
        ? invoiceGrandTotal * (rawItemTotal / invoiceLineSubtotal)
        : rawItemTotal;

      salesItemsList.push({
        id: item.id,
        invoiceId: inv.id,
        customerName: inv.customer_name,
        date: inv.created_at.split('T')[0],
        fabricType: item.fabric_type,
        patternName: item.pattern_name,
        quantityMeters: item.quantity_meters,
        pricePerMeter: item.price_per_meter,
        itemTotal,
        itemCost,
        netProfit: itemTotal - itemCost,
        status: inv.status
      });
    });
  });

  // Sort by date descending
  salesItemsList.sort((a, b) => b.date.localeCompare(a.date));

  // Apply filters
  const filteredSales = salesItemsList.filter(sale => {
    // Fabric filter
    if (fabricFilter !== 'all' && !sale.fabricType.toLowerCase().includes(fabricFilter.toLowerCase())) {
      return false;
    }
    // Tier filter
    if (tierFilter === 'wholesale' && sale.quantityMeters < 100) {
      return false;
    }
    if (tierFilter === 'retail' && sale.quantityMeters >= 100) {
      return false;
    }
    return true;
  });

  const totalMetersSold = filteredSales.reduce((sum, s) => sum + s.quantityMeters, 0);
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.itemTotal, 0);
  const netProfit = filteredSales.reduce((sum, s) => sum + s.netProfit, 0);

  const monthlySalesGroups = useMemo<MonthlySalesGroup[]>(() => {
    const groups = new Map<string, MonthlySalesGroup>();

    filteredSales.forEach(sale => {
      const { key, label } = getSalesMonthGroup(sale);
      const group = groups.get(key) || {
        key,
        label,
        totalSales: 0,
        totalMeters: 0,
        netProfit: 0,
        sales: []
      };

      group.totalSales += sale.itemTotal;
      group.totalMeters += sale.quantityMeters;
      group.netProfit += sale.netProfit;
      group.sales.push(sale);
      groups.set(key, group);
    });

    return Array.from(groups.values());
  }, [filteredSales]);

  // Progress calculations
  const profitProgress = Math.min(100, Math.max(0, (netProfit / MONTHLY_PROFIT_GOAL) * 100));
  const profitRemaining = Math.max(0, MONTHLY_PROFIT_GOAL - netProfit);

  // Chart data simulation: Group sales by date over last 7 days
  const dailyGroups: Record<string, number> = {};
  const today = new Date();
  
  // Seed last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dailyGroups[dateStr] = 0;
  }

  // Populate from database
  salesItemsList.forEach(sale => {
    if (dailyGroups[sale.date] !== undefined) {
      dailyGroups[sale.date] += sale.netProfit;
    }
  });

  // Map to chart items
  const chartData = Object.keys(dailyGroups).map(date => {
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
    const profit = dailyGroups[date];
    // Find absolute max to calculate height percentage
    const maxVal = Math.max(...Object.values(dailyGroups), 100);
    const heightPct = `${Math.max(10, (profit / maxVal) * 85 + 10)}%`; 
    return {
      date,
      day: dayName,
      val: heightPct,
      profit
    };
  });

  return (
    <div className="animate-in subpage-container">
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 1000,
          background: 'rgba(26, 20, 16, 0.95)',
          border: '1.5px solid var(--accent-green)',
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
          <CheckCircle2 size={16} style={{ color: 'var(--accent-green)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Revenue / Profit Goal Section */}
      <div className="screenshot-card" style={{ marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total net profit from each customer sale after deducting RM{COST_PER_METER}/m production cost.</p>
            
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                  RM {netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                  / RM {MONTHLY_PROFIT_GOAL.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px 24px', borderRadius: 16, minWidth: 200, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Remaining to Target</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', fontFamily: 'var(--font-display)' }}>
              RM {profitRemaining.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>

        {/* Liquid Glass Progression Bar */}
        <div style={{ marginTop: 32, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{profitProgress.toFixed(1)}% Completed</span>
            <span style={{ color: 'var(--text-muted)' }}>100%</span>
          </div>
          <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ 
              width: `${profitProgress}%`, 
              height: '100%', 
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 20,
              boxShadow: '0 0 10px rgba(255, 255, 255, 0.05)',
              transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Left Card: 7-day Sales Bar Chart */}
        <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>Daily Net Profit Trajectory</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily net profit generated over the last 7 calendar days.</p>
            </div>
            <div className="chart-time-pill" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />
              Live Feed
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', height: 140, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
            <div className="bar-chart-container" style={{ width: '100%', height: '100%', margin: 0, padding: '0 8px' }}>
              {chartData.map((col, idx) => {
                const isToday = idx === chartData.length - 1;
                return (
                  <div key={col.date} className={`chart-bar-col${isToday ? ' active' : ''}`} style={{ width: '12%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: isToday ? 'var(--accent-green)' : 'var(--text-muted)', marginBottom: 6, fontWeight: 'bold' }}>
                      {col.profit > 0 ? `RM${col.profit.toFixed(0)}` : 'RM0'}
                    </div>
                    <div className="bar-pill-track" style={{ width: 22, height: 100, background: 'rgba(255,255,255,0.02)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                      <div className="bar-pill-fill" style={{ height: col.val, position: 'absolute', bottom: 0, left: 0, right: 0, background: isToday ? 'var(--accent-green)' : 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }} />
                    </div>
                    <span className="bar-label-day" style={{ fontSize: 10, marginTop: 8, color: 'var(--text-muted)' }}>{col.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Dynamic Quick Record Tool */}
        <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title-lg" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>Record Studio Retail Cut</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Log instant cash-and-carry boutique studio transactions. Auto-evaluates prices, logs sales volume, and tracks material depletion.</p>
          </div>

          {!showWalkinForm ? (
            <button className="full-action-btn" style={{ marginTop: 20 }} onClick={() => setShowWalkinForm(true)}>
              <Plus size={14} style={{ marginRight: 6 }} />
              Open Retail Cashier Shell
            </button>
          ) : (
            <WalkinSaleForm 
              onClose={() => setShowWalkinForm(false)} 
              onSuccess={() => {
                setShowWalkinForm(false);
                loadInvoices();
                showToast('Retail sale registered successfully.');
              }} 
            />
          )}
        </div>
      </div>

      {/* Main Table: Detailed Sales Register */}
      <div className="screenshot-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title-lg" style={{ fontSize: 16, marginBottom: 2 }}>Physical Dispatch Sales Log</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Granular fabric ledger showing sold meters, sales value, and per-customer net profit.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="screenshot-select" style={{ width: 140, padding: '6px 10px', fontSize: 11 }} value={fabricFilter} onChange={e => setFabricFilter(e.target.value)}>
              <option value="all">All Fabrics</option>
              <option value="dubai cotton">Dubai Cotton</option>
              <option value="cotton viscose">Cotton Viscose</option>
            </select>

            {/* Wholesale/Retail Tier Filter */}
            <select className="screenshot-select" style={{ width: 140, padding: '6px 10px', fontSize: 11 }} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
              <option value="all">All Tiers</option>
              <option value="wholesale">Wholesale Tier (&ge; 100m)</option>
              <option value="retail">Retail Tier (&lt; 100m)</option>
            </select>
          </div>
        </div>

        <div className="screenshot-table-wrap">
          <table className="screenshot-table">
            <thead>
              <tr>
                <th>Dispatched Date</th>
                <th>Order Ref</th>
                <th>Buyer / Client</th>
                <th>Batik Fabric Type</th>
                <th>Meters Sold</th>
                <th>Unit Rate</th>
                <th>Grand Total Share</th>
                <th>Net Profit</th>
                <th>Tier Classification</th>
              </tr>
            </thead>
            <tbody>
              {monthlySalesGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No sales matching current criteria.</td>
                </tr>
              ) : (
                monthlySalesGroups.map(group => (
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
                            RM {group.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.sales.map(sale => {
                      const isWholesale = sale.quantityMeters >= 100;
                      return (
                        <tr key={sale.id}>
                          <td style={{ fontWeight: 600 }}>{sale.date}</td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{sale.invoiceId}</td>
                          <td style={{ fontWeight: 600 }}>{sale.customerName}</td>
                          <td className="text-secondary">{sale.fabricType}</td>
                          <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{sale.quantityMeters.toFixed(1)} m</td>
                          <td className="text-secondary" style={{ fontFamily: 'var(--font-display)' }}>RM {sale.pricePerMeter.toFixed(2)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>RM {sale.itemTotal.toFixed(2)}</td>
                          <td style={{ fontWeight: 700, color: sale.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-coral)' }}>RM {sale.netProfit.toFixed(2)}</td>
                          <td>
                            <span 
                              style={{ 
                                fontSize: 11, 
                                fontWeight: 'bold', 
                                padding: '4px 12px', 
                                borderRadius: 20,
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                color: 'rgba(255, 255, 255, 0.75)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              {isWholesale ? 'Wholesale' : 'Retail'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface WalkinSaleFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function WalkinSaleForm({ onClose, onSuccess }: WalkinSaleFormProps) {
  const [fabric, setFabric] = useState('Dubai Cotton');
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(40);
  const [submitting, setSubmitting] = useState(false);

  const FABRIC_CATALOG = ['Dubai Cotton', 'Cotton Viscose'];

  // Evaluate tier price dynamically
  const evaluatePrice = async (qty: number) => {
    try {
      const res = await window.electronAPI.calculateTierPrice(qty);
      if (res && typeof res.price === 'number') {
        setPrice(res.price);
      }
    } catch (err) {
      // Fallback
      if (qty >= 1000) setPrice(35);
      else if (qty >= 500) setPrice(37);
      else if (qty >= 100) setPrice(38);
      else setPrice(40);
    }
  };

  useEffect(() => {
    evaluatePrice(quantity);
  }, [quantity]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const walkinRef = `WALK-IN-${Math.floor(Math.random() * 9000) + 1000}`;
      const totalAmount = quantity * price;

      const newInvoice: BatikInvoice = {
        id: walkinRef,
        customer_name: 'Walk-In Boutique Client',
        customer_phone: '60100000000',
        items: [
          {
            id: `ii-walk-${Math.floor(Math.random()*1000)}`,
            fabric_type: fabric,
            pattern_name: '',
            quantity_meters: quantity,
            price_per_meter: price,
            total: totalAmount
          }
        ],
        subtotal: totalAmount,
        discount_type: 'none',
        discount_value: 0,
        discount_amount: 0,
        total: totalAmount,
        status: 'paid',
        created_at: new Date().toISOString()
      };

      await window.electronAPI.saveInvoice(newInvoice);
      onSuccess();
    } catch (err) {
      console.error('Failed to log walkin sale:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <div className="form-group">
        <label className="form-label">Fabric Material Selection</label>
        <select 
          className="screenshot-select" 
          value={fabric} 
          onChange={e => setFabric(e.target.value)}
          style={{ width: '100%', padding: '6px 10px', fontSize: 12 }}
        >
          {FABRIC_CATALOG.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Cut Length (meters)</label>
        <input 
          className="screenshot-input" 
          type="number" 
          style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-display)' }}
          value={quantity || ''} 
          onChange={e => setQuantity(parseFloat(e.target.value) || 0)} 
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
        <div>
          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Tier Price:</span>
          <strong style={{ color: 'var(--text-primary)' }}>RM {price.toFixed(2)}/m</strong>
        </div>
        <div>
          <span style={{ color: 'var(--accent-amber)', marginRight: 4 }}>Total:</span>
          <strong style={{ color: 'var(--accent-amber)', fontSize: 13 }}>RM {(quantity * price).toFixed(2)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 12px' }} onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="action-pill-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '⏳ Logging...' : 'Record Cash'}
        </button>
      </div>
    </div>
  );
}
