import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  AlertTriangle,
  Calendar,
  Plus,
  X,
  Save,
  CheckCircle2,
  Trash2,
  Bookmark,
  ChevronRight,
  TrendingUp,
  Package
} from 'lucide-react';
import { InventoryItem, ProjectAllocation, TailorContact } from '../db/database';

const STATUS_COLORS: Record<string, string> = {
  allocated:  'var(--accent-amber)',
  dispatched: 'var(--accent-cyan)',
  completed:  'var(--accent-green)',
  cancelled:  'var(--accent-coral)'
};

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectAllocation[]>([]);
  const [tailors, setTailors] = useState<TailorContact[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Modals state
  const [showStockForm, setShowStockForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  // New stock form
  const [fabricType, setFabricType] = useState('Dubai Cotton');
  const [patternName, setPatternName] = useState('');
  const [meterage, setMeterage] = useState(100);
  const [type, setType] = useState<'sample' | 'roll' | 'cut'>('roll');
  const [threshold, setThreshold] = useState(100);

  // New project form
  const [projectName, setProjectName] = useState('');
  const [selectedTailorId, setSelectedTailorId] = useState('');
  const [selectedFabricPattern, setSelectedFabricPattern] = useState('');
  const [allocatedMeters, setAllocatedMeters] = useState(50);
  const [dueDate, setDueDate] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const iData = await window.electronAPI.getInventory();
      const pData = await window.electronAPI.getProjects();
      const tData = await window.electronAPI.getTailors();

      setInventory(iData || []);
      setProjects(pData || []);
      setTailors(tData || []);
      
      if (tData && tData.length > 0 && !selectedTailorId) {
        setSelectedTailorId(tData[0].id);
      }
      if (iData && iData.length > 0 && !selectedFabricPattern) {
        setSelectedFabricPattern(`${iData[0].fabric_type} - ${iData[0].pattern_name}`);
      }
    } catch (err) {
      console.error('Failed to load inventory/project data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveStock = async () => {
    try {
      const newItem: InventoryItem = {
        id: `i-${Math.floor(Math.random() * 9000) + 1000}`,
        fabric_type: fabricType,
        pattern_name: '',
        meterage,
        type,
        low_stock_threshold: threshold
      };

      await window.electronAPI.saveInventoryItem(newItem);
      showToast(`Stocked ${newItem.fabric_type}`);
      setShowStockForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to save stock item:', err);
    }
  };

  const handleDeleteStock = async (id: string, name: string) => {
    if (confirm(`Remove fabric stock ${name} entirely from the registry?`)) {
      try {
        const success = await window.electronAPI.deleteInventoryItem(id);
        if (success) {
          showToast('Fabric roll deleted.');
          loadData();
        }
      } catch (err) {
        console.error('Failed to delete stock:', err);
      }
    }
  };

  const handleSaveProject = async () => {
    if (!projectName || !selectedFabricPattern || !dueDate) {
      showToast('Please fill in all project allocation details.');
      return;
    }

    try {
      // Decode selected fabric
      const fabric = selectedFabricPattern.replace(' - ', '').trim();
      
      const newProj: ProjectAllocation = {
        id: `p-${Math.floor(Math.random() * 9000) + 1000}`,
        project_name: projectName,
        tailor_id: selectedTailorId,
        fabric_type: fabric,
        pattern_name: '',
        allocated_meters: allocatedMeters,
        status: 'allocated',
        due_date: dueDate,
        created_at: new Date().toISOString().split('T')[0]
      };

      await window.electronAPI.saveProject(newProj);
      showToast(`Project "${projectName}" allocated successfully!`);
      setProjectName('');
      setShowProjectForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  const handleUpdateProjectStatus = async (proj: ProjectAllocation, nextStatus: ProjectAllocation['status']) => {
    try {
      const updated: ProjectAllocation = {
        ...proj,
        status: nextStatus
      };
      await window.electronAPI.saveProject(updated);
      showToast(`Project updated to: ${nextStatus.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      showToast(`Error updating project: ${err.message}`);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (confirm(`Delete project allocation "${name}"? Outstanding stocks will be reverted.`)) {
      try {
        const success = await window.electronAPI.deleteProject(id);
        if (success) {
          showToast('Project deleted successfully.');
          loadData();
        }
      } catch (err) {
        console.error('Failed to delete project:', err);
      }
    }
  };

  // Compile calculations
  const totalMetersInStock = inventory.reduce((sum, item) => sum + item.meterage, 0);
  const lowStockCount = inventory.filter(item => item.meterage <= item.low_stock_threshold).length;
  const activeAllocatedMeters = projects.filter(p => p.status === 'allocated' || p.status === 'dispatched').reduce((sum, p) => sum + p.allocated_meters, 0);
  const activeProjectsCount = projects.filter(p => p.status === 'allocated' || p.status === 'dispatched').length;

  return (
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
        }}>
          <Package size={16} style={{ color: 'var(--accent-amber)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Dynamic aggregate metrics */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon green" style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(180, 244, 82, 0.15)', color: 'var(--accent-green)' }}>
            <Package size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{totalMetersInStock.toLocaleString()} m</div>
            <div className="stat-label">Physical Fabric Stock</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon coral" style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(248, 113, 113, 0.15)', color: 'var(--accent-coral)' }}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{lowStockCount} items</div>
            <div className="stat-label">Low Stock Alerts</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon blue" style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
            <Layers size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{activeAllocatedMeters.toLocaleString()} m</div>
            <div className="stat-label">Allocated to Workshops</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon purple" style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(192, 132, 252, 0.15)', color: 'var(--accent-purple)' }}>
            <Bookmark size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{activeProjectsCount} projects</div>
            <div className="stat-label">Active Tailor Projects</div>
          </div>
        </div>
      </div>

      {/* Main stacked sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        
        {/* Section 1: Fabric Stock levels */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Batik Fabric Inventory Registry</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monitor fabric roll availability levels, type formats, and low threshold visual alarms.</p>
            </div>
            <button className="verify-btn-style" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowStockForm(!showStockForm)}>
              {showStockForm ? <X size={14} /> : <Plus size={14} />}
              {showStockForm ? 'Close' : 'Add New Fabric'}
            </button>
          </div>

          {showStockForm && (
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              animation: 'fadeUp 0.2s ease both'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--accent-amber)' }}>Register New Fabric Stock</div>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Fabric Material Type</label>
                  <select className="screenshot-select" value={fabricType} onChange={e => setFabricType(e.target.value)}>
                    <option value="Dubai Cotton">Dubai Cotton</option>
                    <option value="Cotton Viscose">Cotton Viscose</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Length (meters) *</label>
                  <input className="screenshot-input" type="number" value={meterage || ''} onChange={e => setMeterage(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Type Format</label>
                  <select className="screenshot-select" value={type} onChange={e => setType(e.target.value as any)}>
                    <option value="roll">Roll (Full Bolts)</option>
                    <option value="cut">Cut (Remnants)</option>
                    <option value="sample">Sample (Design Swatches)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Alarm Threshold (m) *</label>
                  <input className="screenshot-input" type="number" value={threshold || ''} onChange={e => setThreshold(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowStockForm(false)}>Cancel</button>
                <button className="action-pill-btn" onClick={handleSaveStock}>
                  Stock Fabric
                </button>
              </div>
            </div>
          )}

          <div className="screenshot-table-wrap">
            <table className="screenshot-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Fabric Material</th>
                  <th>Available Stock</th>
                  <th>Format Type</th>
                  <th>Alert Threshold</th>
                  <th>Status Indicator</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const isLow = item.meterage <= item.low_stock_threshold;
                  return (
                    <tr 
                      key={item.id}
                      style={{ 
                        background: isLow ? 'rgba(239, 68, 68, 0.02)' : 'none',
                        borderLeft: isLow ? '3px solid var(--accent-coral)' : '3px solid transparent'
                      }}
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--accent-cyan)' }}>{item.id}</td>
                      <td style={{ fontWeight: 600 }}>{item.fabric_type}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: isLow ? 'var(--accent-coral)' : 'var(--text-primary)' }}>
                        {item.meterage.toFixed(1)} m
                      </td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{item.type}</td>
                      <td style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{item.low_stock_threshold} m</td>
                      <td>
                        <span style={{ 
                          fontWeight: 600, 
                          color: isLow ? 'var(--accent-coral)' : 'var(--accent-green)',
                          fontSize: 11 
                        }}>
                          {isLow ? '⚠️ LOW STOCK ALERT' : '✓ Normal'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button 
                            className="search-circle" 
                            style={{ width: 26, height: 26, background: 'rgba(255, 255, 255, 0.02)' }}
                            onClick={() => handleDeleteStock(item.id, item.fabric_type)}
                          >
                            <Trash2 size={12} style={{ color: 'var(--accent-coral)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Project Allocations */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Boutique Stitching Allocations</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Allocate meters to contracted tailors. Dispatched projects automatically deduct the required yardage from physical stock.
              </p>
            </div>
            <button className="verify-btn-style" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowProjectForm(!showProjectForm)}>
              {showProjectForm ? <X size={14} /> : <Plus size={14} />}
              {showProjectForm ? 'Close' : 'Allocate Project'}
            </button>
          </div>

          {showProjectForm && (
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              animation: 'fadeUp 0.2s ease both'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--accent-amber)' }}>Dispatched Material Project Allocation</div>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input className="screenshot-input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Hari Raya Corporate Shirts Batch A" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contracted Tailor / Boutique</label>
                  <select className="screenshot-select" value={selectedTailorId} onChange={e => setSelectedTailorId(e.target.value)}>
                    {tailors.map(t => (
                      <option key={t.id} value={t.id}>{t.store_name} ({t.contact_name})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Select Fabric Roll</label>
                  <select className="screenshot-select" value={selectedFabricPattern} onChange={e => setSelectedFabricPattern(e.target.value)}>
                    {inventory.map(i => (
                      <option key={i.id} value={`${i.fabric_type} - `}>
                        {i.fabric_type} ({i.meterage.toFixed(1)}m available)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Allocated length (meters) *</label>
                  <input className="screenshot-input" type="number" value={allocatedMeters || ''} onChange={e => setAllocatedMeters(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input className="screenshot-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowProjectForm(false)}>Cancel</button>
                <button className="action-pill-btn" onClick={handleSaveProject}>
                  Allocate Materials
                </button>
              </div>
            </div>
          )}

          <div className="screenshot-table-wrap">
            <table className="screenshot-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Contracted Tailor</th>
                  <th>Fabric Material</th>
                  <th>Allocated Meters</th>
                  <th>Due Date</th>
                  <th>Status State</th>
                  <th style={{ textAlign: 'center' }}>Workflow Controls</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No projects allocated yet.</td>
                  </tr>
                ) : (
                  projects.map(proj => {
                    const tailor = tailors.find(t => t.id === proj.tailor_id);
                    return (
                      <tr key={proj.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--accent-cyan)' }}>{proj.id}</td>
                        <td style={{ fontWeight: 600 }}>{proj.project_name}</td>
                        <td style={{ fontWeight: 600 }}>{tailor ? tailor.store_name : 'Direct Tailor'}</td>
                        <td className="text-secondary">{proj.fabric_type}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{proj.allocated_meters.toFixed(1)} m</td>
                        <td className="text-secondary" style={{ fontSize: 12.5 }}>{proj.due_date}</td>
                        <td>
                          <span style={{ 
                            fontWeight: 600, 
                            color: STATUS_COLORS[proj.status] || 'var(--text-muted)',
                            textTransform: 'uppercase',
                            fontSize: 11
                          }}>
                            {proj.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                            {proj.status === 'allocated' && (
                              <button 
                                className="verify-btn-style" 
                                style={{ padding: '4px 10px', fontSize: 10, background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.2)', color: 'var(--accent-cyan)' }}
                                onClick={() => handleUpdateProjectStatus(proj, 'dispatched')}
                                title="Dispatch material rolls (deducts inventory!)"
                              >
                                Dispatch
                              </button>
                            )}
                            {proj.status === 'dispatched' && (
                              <button 
                                className="verify-btn-style" 
                                style={{ padding: '4px 10px', fontSize: 10, background: 'rgba(180, 244, 82, 0.12)', border: '1px solid rgba(180, 244, 82, 0.2)', color: 'var(--accent-green)' }}
                                onClick={() => handleUpdateProjectStatus(proj, 'completed')}
                                title="Stitching Completed"
                              >
                                Complete
                              </button>
                            )}
                            {(proj.status === 'allocated' || proj.status === 'dispatched') && (
                              <button 
                                className="verify-btn-style" 
                                style={{ padding: '4px 10px', fontSize: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: 'var(--accent-coral)' }}
                                onClick={() => handleUpdateProjectStatus(proj, 'cancelled')}
                                title="Cancel Project Allocation (restores inventory!)"
                              >
                                Cancel
                              </button>
                            )}
                            
                            <button 
                              className="search-circle" 
                              style={{ width: 24, height: 24, background: 'rgba(255, 255, 255, 0.02)' }}
                              onClick={() => handleDeleteProject(proj.id, proj.project_name)}
                              title="Delete allocation record"
                            >
                              <Trash2 size={11} style={{ color: 'var(--accent-coral)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
