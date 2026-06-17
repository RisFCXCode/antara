import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MapPin,
  ChevronRight,
  Flame,
  CheckCircle2,
  Clock,
  Briefcase,
  X,
  Target,
  MoreVertical,
  Activity,
  Save,
  Phone,
  Mail,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Trash2,
  User,
  ExternalLink
} from 'lucide-react';
import { Lead } from '../db/database';

export default function LeadIntelligence() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterTier, setFilterTier] = useState('all');

  // Detail View
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Add Lead Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [generateLocation, setGenerateLocation] = useState('Kuala Lumpur');
  const [generateIndustry, setGenerateIndustry] = useState('Hotel');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLogs, setGenerateLogs] = useState<string[]>([]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getLeads();
      setLeads(data || []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLeads = async () => {
    setIsGenerating(true);
    setGenerateLogs(['🚀 Initializing Automated Intelligence Engine...']);
    
    // Listen to real-time progress from Electron Main Process
    window.electronAPI.onLeadGenerationProgress((msg: string) => {
      setGenerateLogs(prev => [...prev, msg]);
    });

    try {
      await window.electronAPI.generateLeads(generateLocation, generateIndustry);
      setGenerateLogs(prev => [...prev, '✅ Generation complete. Refreshing dashboard...']);
      await loadLeads();
      setTimeout(() => setShowAddModal(false), 2000);
    } catch (err: any) {
      setGenerateLogs(prev => [...prev, `❌ Critical Failure: ${err.message}`]);
    } finally {
      window.electronAPI.removeLeadGenerationProgressListener();
      setIsGenerating(false);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await window.electronAPI.deleteLead(id);
      if (selectedLead?.id === id) setSelectedLead(null);
      await loadLeads();
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  // Summary Metrics
  const hotLeads = leads.filter(l => l.lead_tier === 'A').length;
  const warmLeads = leads.filter(l => l.lead_tier === 'B').length;
  const inPipeline = leads.filter(l => ['Researched', 'Contacted', 'Proposal Sent', 'Negotiating'].includes(l.stage)).length;

  const filteredLeads = leads.filter(l => {
    if (filterStage !== 'all' && l.stage !== filterStage) return false;
    if (filterTier !== 'all' && l.lead_tier !== filterTier) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!l.company_name.toLowerCase().includes(q) && 
          !l.industry.toLowerCase().includes(q) &&
          !l.city?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A': return 'var(--text-primary)';
      case 'B': return 'var(--text-primary)';
      case 'C': return 'var(--text-muted)';
      case 'D': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className="animate-in subpage-container">
      
      {/* Top Hero Card (Matches Invoices style) */}
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
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.01em', marginBottom: 6 }}>Lead Intelligence Engine</div>
            <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 14 }}>
              {leads.length} Target Accounts
              <div className="action-pill-btn" style={{ transform: 'translateY(-2px)', padding: '6px 14px', fontSize: 12, cursor: 'default' }}>
                <span><strong style={{ color: '#fff' }}>{inPipeline}</strong> Active in Pipeline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="screenshot-card" style={{ marginBottom: 20, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="screenshot-input"
              type="text" 
              placeholder="Search leads..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 34, width: '100%', fontSize: 12 }}
            />
          </div>
          <select className="screenshot-select" style={{ width: 140, padding: '8px 12px', fontSize: 12 }} value={filterTier} onChange={e => setFilterTier(e.target.value)}>
            <option value="all">All Tiers</option>
            <option value="A">Hot (80-100)</option>
            <option value="B">Warm (60-79)</option>
            <option value="C">Lukewarm (40-59)</option>
            <option value="D">Cold (0-39)</option>
          </select>
          <select className="screenshot-select" style={{ width: 150, padding: '8px 12px', fontSize: 12 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
            <option value="all">All Stages</option>
            <option value="New">New</option>
            <option value="Researched">Researched</option>
            <option value="Contacted">Contacted</option>
            <option value="Proposal Sent">Proposal Sent</option>
            <option value="Negotiating">Negotiating</option>
          </select>
        </div>
        
        <button className="verify-btn-style" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAddModal(true)}>
          <Search size={14} /> Generate Leads
        </button>
      </div>

      {/* Leads Table */}
      <div className="screenshot-table-wrap">
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading intelligence...</div>
        ) : (
          <table className="screenshot-table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Company</th>
                <th>Industry</th>
                <th>Location</th>
                <th>Employees</th>
                <th>Pipeline Stage</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                    No leads found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{ cursor: 'pointer' }}>
                    <td style={{ width: '80px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontFamily: 'var(--font-display)', color: getTierColor(lead.lead_tier) }}>
                        {lead.lead_score}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.company_name}</td>
                    <td className="text-secondary" style={{ fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Briefcase size={12} style={{ color: 'var(--text-muted)' }} />
                        {lead.industry}
                      </div>
                    </td>
                    <td className="text-secondary" style={{ fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                        {lead.city || '—'}
                      </div>
                    </td>
                    <td className="text-secondary" style={{ fontSize: 12.5 }}>{lead.employee_count ? `${lead.employee_count}+` : '—'}</td>
                    <td>
                      <span style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)', 
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: 11,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(12px)',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        {lead.stage}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button 
                          className="search-circle" 
                          style={{ 
                            width: 28, height: 28, 
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.15)'
                          }} 
                          title="Delete Lead"
                          onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                        >
                          <Trash2 size={12} style={{ color: '#ef4444' }} />
                        </button>
                        <button 
                          className="search-circle" 
                          style={{ 
                            width: 28, height: 28, 
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }} 
                          title="View Profile"
                          onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                        >
                          <ChevronRight size={14} style={{ color: 'var(--text-primary)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Generate Leads Modal (Glassmorphism overlay) */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.60)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeUp 0.22s ease both'
        }}>
          <div 
            style={{
              background: 'rgba(15, 15, 15, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 22,
              padding: '30px 26px 22px',
              width: 500, maxWidth: '92vw',
              boxShadow: '0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
              display: 'flex', flexDirection: 'column', gap: 22,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 19, margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>Automated Lead Engine</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Web Scraping & Autonomous Profiling</div>
              </div>
              {!isGenerating && (
                <button 
                  onClick={() => setShowAddModal(false)}
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
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Target Location</label>
                <select className="screenshot-select" style={{ padding: '10px' }} value={generateLocation} onChange={e => setGenerateLocation(e.target.value)} disabled={isGenerating}>
                  <option value="Kuala Lumpur">Kuala Lumpur</option>
                  <option value="Selangor">Selangor</option>
                  <option value="Johor">Johor</option>
                  <option value="Penang">Penang</option>
                  <option value="Sabah">Sabah</option>
                  <option value="Sarawak">Sarawak</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Industry</label>
                <select className="screenshot-select" style={{ padding: '10px' }} value={generateIndustry} onChange={e => setGenerateIndustry(e.target.value)} disabled={isGenerating}>
                  <option value="Hotel">Hotels & Hospitality</option>
                  <option value="Bank">Banks & Finance</option>
                  <option value="University">Universities & Education</option>
                  <option value="Hospital">Hospitals & Healthcare</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Corporate">Corporate Enterprises</option>
                </select>
              </div>

              {/* Progress Terminal */}
              <div style={{ 
                background: 'rgba(0,0,0,0.4)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                padding: 12, 
                height: 140, 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontFamily: 'monospace',
                fontSize: 11,
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)'
              }}>
                {generateLogs.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>Waiting to start engine...</span>
                ) : (
                  generateLogs.map((log, i) => (
                    <span key={i} style={{ color: log.includes('❌') ? 'var(--text-primary)' : log.includes('✅') || log.includes('✨') ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {log}
                    </span>
                  ))
                )}
                {isGenerating && (
                  <span style={{ color: 'var(--text-primary)', animation: 'pulse 1.5s infinite' }}>
                    _ Processing...
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              {!isGenerating && <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>}
              <button 
                className="action-pill-btn" 
                onClick={handleGenerateLeads} 
                disabled={isGenerating}
                style={{ opacity: isGenerating ? 0.7 : 1 }}
              >
                {isGenerating ? 'Scanning...' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Lead Detail Panel (Glassmorphism) */}
      {selectedLead && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeUp 0.2s ease both'
        }}>
          <div style={{
            width: 800,
            background: 'rgba(15, 15, 15, 0.95)',
            backdropFilter: 'blur(30px) saturate(200%)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            height: '100%',
            overflowY: 'auto',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Panel Header */}
            <div style={{ 
              padding: '32px 40px 24px', 
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 26, margin: '0 0 6px 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selectedLead.company_name}
                    <span className="action-pill-btn" style={{ 
                      padding: '4px 12px', fontSize: 12, cursor: 'default' 
                    }}>Score: {selectedLead.lead_score}/100</span>
                  </h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={12}/> {selectedLead.industry}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={12}/> {selectedLead.city || 'Location Unknown'}</span>
                  </p>
                </div>
              </div>
              <button 
                className="search-circle" 
                style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.04)' }}
                onClick={() => setSelectedLead(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 28, flex: 1 }}>
              
              {/* Pipeline Tracker */}
              <div className="screenshot-card" style={{ padding: '20px 24px' }}>
                <h4 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.05em', fontWeight: 700 }}>Sales Pipeline Stage</h4>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {['New', 'Researched', 'Contacted', 'Proposal Sent', 'Negotiating', 'Closed'].map((stage, i) => {
                    const stages = ['New', 'Researched', 'Contacted', 'Proposal Sent', 'Negotiating', 'Closed'];
                    const currentIdx = stages.indexOf(selectedLead.stage);
                    const isActive = i === currentIdx;
                    const isPassed = i < currentIdx;
                    
                    return (
                      <React.Fragment key={stage}>
                        <div style={{ 
                          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: isActive ? 600 : 500,
                          background: isActive ? 'rgba(255,255,255,0.1)' : isPassed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                          color: isActive ? 'var(--text-primary)' : isPassed ? 'var(--text-secondary)' : 'var(--text-muted)',
                          border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                          flexShrink: 0
                        }}>
                          {stage}
                        </div>
                        {i < 5 && <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.1)', alignSelf: 'center' }} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Grid Intel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="screenshot-card" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, letterSpacing: '0.05em', fontWeight: 700 }}>Contact Information</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={12} color="var(--text-secondary)"/></div>
                      {selectedLead.decision_maker || 'Undisclosed'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={12} color="var(--text-secondary)"/></div>
                      {selectedLead.phone || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={12} color="var(--text-secondary)"/></div>
                      {selectedLead.email || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MapPin size={12} color="var(--text-secondary)"/></div>
                      <div style={{ marginTop: 4, lineHeight: 1.5 }}>{selectedLead.address || '—'}<br/>{selectedLead.city} {selectedLead.postcode}</div>
                    </div>
                  </div>
                </div>

                <div className="screenshot-card" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, letterSpacing: '0.05em', fontWeight: 700 }}>Corporate Intel</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Employees</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.employee_count ? `${selectedLead.employee_count}+` : 'Unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Uniform Replacements</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedLead.uniform_frequency || 'Unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Capacity Needs</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.estimated_order_min ? `${selectedLead.estimated_order_min}m+` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Registration</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.registration_type || '—'}</span>
                    </div>
                    {selectedLead.linkedin_url && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>LinkedIn</span>
                        <a href={selectedLead.linkedin_url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                          <ExternalLink size={12} /> View Profile
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced Scoring Breakdown */}
              <div className="screenshot-card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, letterSpacing: '0.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Algorithmic Score Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 16, alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Industry Match</span>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ width: '80%', height: '100%', background: 'var(--text-primary)' }} />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)' }}>20/25</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 16, alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Company Size</span>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ width: '50%', height: '100%', background: 'var(--text-primary)' }} />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)' }}>10/20</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 16, alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Uniform Freq.</span>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ width: '20%', height: '100%', background: 'var(--text-primary)' }} />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)' }}>3/15</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      This profile is missing comprehensive online presence metrics. Updating LinkedIn and Website fields may yield up to <strong style={{ color: 'var(--text-primary)' }}>10</strong> additional score points.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar bottom */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: 16, paddingTop: 16 }}>
                <button className="verify-btn-style" style={{ flex: 1, padding: '12px 0', fontSize: 13, display: 'flex', justifyContent: 'center', gap: 8 }}>
                  Send Pitch Email
                </button>
                <button className="verify-btn-style" style={{ flex: 1, padding: '12px 0', fontSize: 13, display: 'flex', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}>
                  Schedule Follow-up
                </button>
                <button className="search-circle" style={{ width: 44, height: 44 }}>
                  <MoreVertical size={16} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
