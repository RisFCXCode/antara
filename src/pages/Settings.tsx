import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Target,
  Printer,
  ShieldAlert,
  Save,
  Check,
  Activity,
  UserCheck
} from 'lucide-react';
import { AuditLog } from '../db/database';

type Section = 'studio' | 'leads' | 'pdf' | 'audit';

interface SectionItem {
  id: Section;
  icon: React.ComponentType<any>;
  label: string;
}

const SECTIONS: SectionItem[] = [
  { id: 'studio',    icon: Building, label: 'Studio Profile' },
  { id: 'leads',     icon: Target, label: 'Lead Engine' },
  { id: 'pdf',       icon: Printer, label: 'Branded PDF Theme' },
  { id: 'audit',     icon: Activity, label: 'Operational Audit' },
];

export default function Settings() {
  const [section, setSection] = useState<Section>('studio');
  const [saved, setSaved] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 });

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const logs = await window.electronAPI.getAuditLogs();
      setAuditLogs(logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (section === 'audit') {
      loadAuditLogs();
    }
  }, [section]);

  useEffect(() => {
    if (tabsRef.current) {
      const activeEl = tabsRef.current.querySelector('.header-tab-btn.active') as HTMLElement;
      if (activeEl) {
        setIndicatorStyle({
          top: activeEl.offsetTop,
          height: activeEl.offsetHeight
        });
      }
    }
  }, [section]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, height: 'calc(100vh - 180px)' }}>
      {/* Section nav */}
      <div 
        className="screenshot-card" 
        ref={tabsRef} 
        style={{ 
          padding: '16px 12px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 6,
          position: 'relative',
          height: 'fit-content'
        }}
      >
        {/* Continuous motion vertical sliding background pill */}
        {indicatorStyle.height > 0 && (
          <div 
            className="header-tab-indicator-vertical" 
            style={{ 
              top: indicatorStyle.top,
              height: indicatorStyle.height
            }}
          />
        )}

        {SECTIONS.map(s => {
          const IconComponent = s.icon;
          return (
            <button
              key={s.id}
              className={`header-tab-btn${section === s.id ? ' active' : ''}`}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                width: '100%', 
                textAlign: 'left', 
                padding: '14px 20px', 
                fontSize: 14,
                position: 'relative',
                zIndex: 1
              }}
              onClick={() => setSection(s.id)}
            >
              <IconComponent size={16} />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="screenshot-card" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="tab-content-fade" key={section} style={{ flexGrow: 1 }}>
          {section === 'studio' && (
            <SettingsSection title="Batik Studio Profile" icon={Building} subtitle="Batik business registrations, brand parameters, and official contacts">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Brand Store Name</label>
                  <input className="screenshot-input" defaultValue="Antara Batik Enterprise" />
                </div>
                <div className="form-group">
                  <label className="form-label">SSM Registration No.</label>
                  <input className="screenshot-input" defaultValue="SA-0498112-D" placeholder="e.g. SA-0XXXXXX-X" />
                </div>
                <div className="form-group">
                  <label className="form-label">Support Email Address</label>
                  <input className="screenshot-input" defaultValue="operations@antarabatik.com.my" placeholder="operations@yourbrand.com.my" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Landline</label>
                  <input className="screenshot-input" defaultValue="+603-5511 8800" placeholder="+603-XXXX XXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">State Hub Location</label>
                  <select className="screenshot-select">
                    <option value="10">10 — Selangor Darul Ehsan</option>
                    <option value="14">14 — WP Kuala Lumpur</option>
                    <option value="01">01 — Johor Darul Ta'zim</option>
                    <option value="07">07 — Pulau Pinang</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input className="screenshot-input" defaultValue="MYR (RM)" disabled style={{ opacity: 0.7 }} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Official Registered HQ Address</label>
                <input className="screenshot-input" defaultValue="No. 15, Kampung Batik Heritage, Seksyen 7," style={{ marginBottom: 6 }} />
                <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <input className="screenshot-input" defaultValue="Shah Alam, Selangor" />
                  <input className="screenshot-input" defaultValue="40000" maxLength={5} />
                </div>
              </div>
            </SettingsSection>
          )}

          {section === 'leads' && (
            <SettingsSection title="Lead Intelligence Engine" icon={Target} subtitle="Configure scraping intervals and API thresholds">
              <div className="form-group">
                <label className="form-label">Auto-Refresh Interval</label>
                <input className="screenshot-input" defaultValue="30 Days" />
              </div>
            </SettingsSection>
          )}

          {section === 'pdf' && (
            <SettingsSection title="Branded PDF Renderer Theme" icon={Printer} subtitle="Customize elegance settings for PDF commercial outputs (strictly PDF only)">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Primary Background Hex</label>
                  <input className="screenshot-input" defaultValue="#1a1410" style={{ fontFamily: 'var(--font-display)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Secondary Background Hex</label>
                  <input className="screenshot-input" defaultValue="#2a2420" style={{ fontFamily: 'var(--font-display)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Accent Highlight Gold Hex</label>
                  <input className="screenshot-input" defaultValue="#cfab6d" style={{ fontFamily: 'var(--font-display)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Body Off-white Hex</label>
                  <input className="screenshot-input" defaultValue="#f5f1ed" style={{ fontFamily: 'var(--font-display)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Typographical Branding Font</label>
                  <select className="screenshot-select">
                    <option value="Playfair">Playfair Display &amp; Plus Jakarta Sans (Elegant Serif)</option>
                    <option value="Cinzel">Cinzel &amp; Inter (Classic Heritage)</option>
                    <option value="Cormorant">Cormorant Garamond &amp; Outfit (Luxury Modern)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Print Scale Margin</label>
                  <select className="screenshot-select">
                    <option value="none">Zero Margins (Recommended CSS-controlled)</option>
                    <option value="minimum">Minimum Margins</option>
                    <option value="standard">Standard A4 margins</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" defaultChecked />
                  Include handcrafted watermark overlay
                </label>
                <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <input type="checkbox" defaultChecked />
                  Enforce immediate opening in default OS PDF Viewer
                </label>
              </div>
            </SettingsSection>
          )}

          {section === 'audit' && (
            <SettingsSection title="Operational Activity Audit Log" icon={Activity} subtitle="Review ACID-compliant transactional logs recorded by the Antara Batik platform.">
              <div className="screenshot-table-wrap" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                {loadingAudit ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs registry…</div>
                ) : auditLogs.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs recorded yet.</div>
                ) : (
                  <table className="screenshot-table" style={{ fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Module</th>
                        <th>Action Performed</th>
                        <th>Result Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => {
                        let moduleBadgeColor = 'var(--text-muted)';
                        if (log.module === 'invoice') moduleBadgeColor = 'var(--accent-cyan)';
                        if (log.module === 'whatsapp') moduleBadgeColor = 'var(--accent-green)';
                        if (log.module === 'inventory') moduleBadgeColor = 'var(--accent-purple)';
                        if (log.module === 'project') moduleBadgeColor = 'var(--accent-amber)';

                        return (
                          <tr key={log.id}>
                            <td style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleString('en-MY')}
                            </td>
                            <td>
                              <span style={{ 
                                fontSize: 9.5, 
                                fontWeight: 'bold', 
                                padding: '2px 6px', 
                                borderRadius: 5, 
                                background: `${moduleBadgeColor}15`, 
                                color: moduleBadgeColor,
                                textTransform: 'uppercase'
                              }}>
                                {log.module}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{log.action}</td>
                            <td className="text-secondary">{log.result}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </SettingsSection>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
          {saved && (
            <span className="badge badge-green" style={{ alignSelf: 'center', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(180, 244, 82, 0.15)', color: 'var(--accent-green)' }}>
              <Check size={14} />
              Saved successfully
            </span>
          )}
          <button className="verify-btn-style" onClick={loadAuditLogs} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Refresh Registry
          </button>
          <button className="action-pill-btn" onClick={handleSave} style={{ background: 'var(--accent-amber)', color: '#1a1410', fontWeight: 'bold' }}>
            <Save size={14} style={{ marginRight: 6 }} />
            Save Configurations
          </button>
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  icon: React.ComponentType<any>;
  subtitle: string;
  children: React.ReactNode;
}

function SettingsSection({ title, icon: Icon, subtitle, children }: SettingsSectionProps) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)' }}>
          <Icon size={18} style={{ color: 'var(--accent-amber)' }} />
          {title}
        </div>
        <div className="text-sm text-muted" style={{ marginTop: 4, color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      <div className="divider" style={{ margin: '14px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} />
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
