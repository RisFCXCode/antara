import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer
} from 'lucide-react';
import { BatikInvoice, TailorContact, InventoryItem, ProjectAllocation } from '../db/database';

interface DashboardProps {
  navigateTo: (page: any) => void;
}

export default function Dashboard({ navigateTo }: DashboardProps) {
  const [invoices, setInvoices] = useState<BatikInvoice[]>([]);
  const [tailors, setTailors] = useState<TailorContact[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const invList = await window.electronAPI.getInvoices();
        const tList = await window.electronAPI.getTailors();
        const iList = await window.electronAPI.getInventory();
        const pList = await window.electronAPI.getProjects();

        setInvoices(invList || []);
        setTailors(tList || []);
        setInventory(iList || []);
        setProjects(pList || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute metrics dynamically from local DB
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const activeInvoices = invoices.filter(inv => inv.status === 'paid' || inv.status === 'pending');
  
  // Total meters sold
  let totalMetersSold = 0;
  let dubaiCottonMeters = 0;
  let cottonViscoseMeters = 0;

  activeInvoices.forEach(inv => {
    inv.items.forEach(item => {
      totalMetersSold += item.quantity_meters;
      const type = item.fabric_type.toLowerCase();
      if (type.includes('dubai cotton')) {
        dubaiCottonMeters += item.quantity_meters;
      } else if (type.includes('viscose') || type.includes('cotton viscose')) {
        cottonViscoseMeters += item.quantity_meters;
      }
    });
  });

  const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Compute Fabric Ratios
  const dubaiPct = totalMetersSold > 0 ? Math.round((dubaiCottonMeters / totalMetersSold) * 100) : 60;
  const viscosePct = totalMetersSold > 0 ? Math.round((cottonViscoseMeters / totalMetersSold) * 100) : 40;

  const lowStockItems = inventory.filter(item => item.meterage <= item.low_stock_threshold);
  const activeProjects = projects.filter(p => p.status === 'allocated' || p.status === 'dispatched');

  return (
    <div className="animate-in">
      {/* Top Grid of 3 Rounded Glass Cards */}
      <div className="dashboard-grid-top">
        
        {/* Card 1: Sales Performance & Material Share */}
        <div className="screenshot-card">
          <div className="card-title-lg" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Batik Sales share</div>
          
          <div className="activity-metric">
            <span className="metric-value-huge">{totalMetersSold.toLocaleString()}m</span>
            <span className="metric-label-side">Total Fabrics Sold</span>
          </div>

          {/* Segmented Progress Bar (Match Liquid Glass Design) */}
          <div className="segmented-progress" style={{ margin: '24px 0 14px' }}>
            <div className="segment-fill cyan" style={{ width: `${dubaiPct}%` }} title={`Dubai Cotton: ${dubaiPct}%`} />
            <div className="segment-fill orange" style={{ width: `${viscosePct}%` }} title={`Cotton Viscose: ${viscosePct}%`} />
          </div>

          <div className="segmented-labels" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between' }}>
            <span className="segment-lbl" style={{ color: 'var(--accent-cyan)' }}>Dubai Cotton ({dubaiPct}%)</span>
            <span className="segment-lbl" style={{ color: 'var(--accent-amber)' }}>Cotton Viscose ({viscosePct}%)</span>
          </div>

          {/* 3 Frosted Circle Buttons */}
          <div className="stats-button-row">
            <div className="stats-circle-box" onClick={() => navigateTo('whatsapp')}>
              <div className="circle-badge-wrapper green">
                <Users size={16} />
              </div>
              <div className="box-number">{tailors.length}</div>
              <div className="box-label">Active Tailors</div>
            </div>

            <div className="stats-circle-box" onClick={() => navigateTo('invoices')}>
              <div className="circle-badge-wrapper cyan">
                <Layers size={16} />
              </div>
              <div className="box-number">{invoices.length}</div>
              <div className="box-label">Batik Invoices</div>
            </div>

            <div className="stats-circle-box" onClick={() => navigateTo('inventory')}>
              <div className="circle-badge-wrapper yellow">
                <Sparkles size={16} />
              </div>
              <div className="box-number">{lowStockItems.length}</div>
              <div className="box-label">Low Stock Alerts</div>
            </div>
          </div>
        </div>

        {/* Card 2: Antara Batik Workspace & Operations Suite */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span className="outline-pill-badge green">Heritage Studio</span>
            <span className="outline-pill-badge cyan">Tier Pricing Active</span>
          </div>

          <div className="card-title-lg" style={{ fontSize: 20, marginBottom: 12 }}>Antara Batik Operations</div>
          <p className="screenshot-subtitle">
            Premium Malaysian Batik ecosystem coordinator. Automatically evaluates tiered meter pricing, tracks handcrafted designs, and coordinates bulk messaging to collaborated tailors.
          </p>

          <div className="action-card-footer">
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>System Integrity</div>
              <div className="avatar-stack-wrap">
                <div className="stack-avatar" style={{ background: '#cfab6d', color: '#1a1410', fontWeight: 'bold' }}>WA</div>
                <div className="stack-avatar" style={{ background: '#b4f452', color: '#1a1410', fontWeight: 'bold' }}>PDF</div>
                <div className="stack-avatar" style={{ background: '#38bdf8', color: '#1a1410', fontWeight: 'bold' }}>DB</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Wholesale Ratio</div>
              <div 
                className="badge badge-amber" 
                style={{ 
                  padding: '6px 14px', 
                  background: 'rgba(251, 191, 36, 0.08)', 
                  border: '1px solid rgba(251, 191, 36, 0.25)', 
                  borderRadius: 20,
                  backdropFilter: 'blur(12px) saturate(200%)',
                  boxShadow: 'inset 0 1px 0 rgba(251, 191, 36, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>RM {totalRevenue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          <button className="full-action-btn" onClick={() => navigateTo('invoices')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span>Generate Branded Invoice</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 3: SLA Activity Bar Chart */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title-lg" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 0 }}>Daily Dispatch Log</div>
            <div className="chart-time-pill">
              <Calendar size={11} />
              Last 7 days
            </div>
          </div>

          <div className="hours-value-row">
            <span className="metric-value-huge" style={{ fontSize: 38 }}>265m</span>
            <span className="metric-label-side" style={{ fontSize: 12 }}>Avg Daily Dispatch</span>
            <span 
              className="chart-cyan-tag" 
              style={{ 
                background: 'rgba(180, 244, 82, 0.08)', 
                color: 'var(--accent-green)', 
                border: '1px solid rgba(180, 244, 82, 0.25)',
                backdropFilter: 'blur(12px) saturate(200%)',
                boxShadow: 'inset 0 1px 0 rgba(180, 244, 82, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              ↑ 18%
            </span>
          </div>

          {/* Premium Vertical Bar Chart (Friday Active Highlight) */}
          <div className="bar-chart-container">
            {[
              { day: 'Mon', val: '45%' },
              { day: 'Tue', val: '30%' },
              { day: 'Wed', val: '65%' },
              { day: 'Thu', val: '50%' },
              { day: 'Fri', val: '95%', active: true },
              { day: 'Sat', val: '55%' },
              { day: 'Sun', val: '40%' }
            ].map(col => (
              <div key={col.day} className={`chart-bar-col${col.active ? ' active' : ''}`}>
                <div className="bar-pill-track" style={{ width: 20 }}>
                  <div className="bar-pill-fill" style={{ height: col.val, background: col.active ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.12)' }} />
                </div>
                <span className="bar-label-day">{col.day}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Grid of 2 Columns */}
      <div className="dashboard-grid-bottom">
        
        {/* Card 4: Upcoming Project Allocations */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Upcoming Tailor Allocations</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monitor outstanding fabric roll allocations dispatched to collaborative boutique workshops.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="search-circle" style={{ width: 32, height: 32 }} onClick={() => navigateTo('inventory')}>
                <ChevronLeft size={14} />
              </button>
              <button className="search-circle" style={{ width: 32, height: 32 }} onClick={() => navigateTo('inventory')}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="deadlines-carousel">
            {projects.slice(0, 3).map((proj, idx) => {
              const tailor = tailors.find(t => t.id === proj.tailor_id);
              const isDispatched = proj.status === 'dispatched';
              const isCompleted = proj.status === 'completed';
              
              let statusBadgeClass = 'yellow';
              if (isDispatched) statusBadgeClass = 'cyan';
              if (isCompleted) statusBadgeClass = 'green';

              return (
                <div key={proj.id} className="deadline-flow-card" onClick={() => navigateTo('inventory')}>
                  <div>
                    <span className="deadline-time">Due on {proj.due_date}</span>
                    <div className="deadline-title" style={{ fontSize: 14, margin: '8px 0' }}>{proj.project_name}</div>
                  </div>
                  
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Material: <strong style={{ color: 'var(--text-primary)' }}>{proj.allocated_meters}m</strong> {proj.fabric_type}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span className={`deadline-badge ${statusBadgeClass}`} style={{ textTransform: 'capitalize' }}>
                        {proj.status}
                      </span>
                      
                      <div className="deadline-owner-profile" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="stack-avatar" style={{ background: '#cfab6d', color: '#1a1410', marginLeft: 0, width: 24, height: 24, fontSize: 8 }}>
                          {tailor ? tailor.contact_name.substring(0, 2).toUpperCase() : 'TL'}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div className="owner-name" style={{ fontSize: 9, fontWeight: 'bold' }}>{tailor ? tailor.contact_name : 'Boutique'}</div>
                          <div className="owner-role" style={{ fontSize: 8, color: 'var(--text-muted)' }}>{tailor ? tailor.store_name : 'Tailoring'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 5: Inventory Stock Levels & Alerts */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 0 }}>Fabric Inventory Levels</div>
            <button className="search-circle" style={{ width: 32, height: 32 }} onClick={() => navigateTo('inventory')}>
              <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="platform-checklist">
            {inventory.slice(0, 4).map((item) => {
              const isLowStock = item.meterage <= item.low_stock_threshold;
              return (
                <div 
                  key={item.id} 
                  className="platform-row" 
                  style={isLowStock ? { borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.04)' } : undefined}
                >
                  <div className="platform-lbl-col" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span 
                      className="platform-double-check" 
                      style={{ color: isLowStock ? 'var(--accent-coral)' : 'var(--accent-green)', display: 'flex', alignItems: 'center' }}
                    >
                      {isLowStock ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.fabric_type}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Format: {item.type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="platform-stat-value" style={{ fontFamily: 'var(--font-display)', fontWeight: 'bold', color: isLowStock ? 'var(--accent-coral)' : 'var(--text-primary)' }}>
                      {item.meterage} m
                    </span>
                    {isLowStock && (
                      <span style={{ fontSize: 8, background: 'rgba(248,113,113,0.1)', color: 'var(--accent-coral)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                        Low Stock
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
