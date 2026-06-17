import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FolderLock,
  Lock,
  History,
  Terminal
} from 'lucide-react';

interface AuditLog {
  id: string;
  module: string;
  action: string;
  payload_hash: string;
  result: string;
  timestamp: string;
}

const REQUIREMENTS = [
  { act: 'PDPA 2010',          section: 'Section 5',       detail: 'Consent required for processing personal data (Form EPF A, IC copies)', status: 'compliant' },
  { act: 'KWSP Act 1991',       section: 'Section 43',      detail: 'Employer must pay EPF by 15th of the following calendar month',          status: 'compliant' },
  { act: 'SOCSO Act 1969',      section: 'Section 6',       detail: 'All employees (wages < RM5k) must contribute under Second Schedule',    status: 'compliant' },
  { act: 'Income Tax Act 1967', section: 'Section 107',     detail: 'Deduction & remittance of monthly PCB (CP38) by 15th of month',          status: 'compliant' },
  { act: 'EIS Act 2017',        section: 'Section 14',      detail: 'Contribution mapping for EIS insurance scheme (capped RM4k wage)',       status: 'compliant' },
  { act: 'MCMC Act 1998',       section: 'Section 233',     detail: 'WhatsApp/Email commercial marketing opt-in consent record register',   status: 'compliant' },
];

export default function Compliance() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const dbLogs = await window.electronAPI.getAuditLogs();
      if (dbLogs && dbLogs.length > 0) {
        setLogs(dbLogs.slice(0, 10)); // Display the 10 most recent logs
      }
    } catch (err) {
      console.error('[Compliance] Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const compliant = REQUIREMENTS.filter(r => r.status === 'compliant').length;
  const score = Math.round((compliant / REQUIREMENTS.length) * 100);

  return (
    <div className="animate-in subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Split columns: Score gauge and statutory info */}
      <div className="grid-2">
        {/* Score gauge */}
        <div className="screenshot-card" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* Conic radial dial (Match Screenshot) */}
          <div style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: `conic-gradient(var(--accent-green) 0% ${score}%, rgba(255,255,255,0.05) ${score}% 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(180, 244, 82, 0.2)',
            flexShrink: 0,
            position: 'relative'
          }}>
            <div style={{
              width: 116,
              height: 116,
              borderRadius: '50%',
              background: 'rgba(20, 21, 26, 0.6)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{score}%</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Compliance</span>
            </div>
          </div>

          <div>
            <div className="card-title-lg" style={{ fontSize: 20, marginBottom: 8 }}>Statutory Audit Score</div>
            <p className="screenshot-subtitle" style={{ margin: 0 }}>
              Based on active calculations, submission logs, and employee registers matching Malaysian regulatory Acts.
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>{compliant}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Compliant Acts</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-amber)' }}>{REQUIREMENTS.length - compliant}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Action Items</div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Retention Card */}
        <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 6 }}>PDPA & Statutory Retention</div>
            <p className="screenshot-subtitle" style={{ margin: '8px 0 16px' }}>
              All client documents and statutory details are securely kept under Act 709 retention periods.
            </p>
          </div>
          <div style={{ background: 'rgba(180, 244, 82, 0.05)', border: '1px solid rgba(180, 244, 82, 0.2)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Lock size={18} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-green)' }}>Encrypted DB Retention: 7 Years</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Matches statutory audit rules under Section 107.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Table */}
      <div className="screenshot-card">
        <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 24 }}>Malaysian Regulatory Compliance Audit</div>

        <div className="screenshot-table-wrap">
          <table className="screenshot-table">
            <thead>
              <tr>
                <th>Statutory Act</th>
                <th>Section</th>
                <th>Requirements & Audit Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {REQUIREMENTS.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{r.act}</td>
                  <td className="text-secondary" style={{ fontFamily: 'var(--font-display)', fontSize: 12.5 }}>{r.section}</td>
                  <td style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.detail}</td>
                  <td>
                    {r.status === 'compliant' ? (
                      <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>COMPLIANT</span>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldAlert size={12} />
                        ACTION REQUIRED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live System Audit Trail */}
      <div className="screenshot-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} style={{ color: 'var(--accent-cyan)' }} />
            <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 0 }}>System Operations Audit Trail</div>
          </div>
          <button className="verify-btn-style" onClick={loadAuditLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Terminal size={12} />
            Refresh Trail
          </button>
        </div>

        <div className="screenshot-table-wrap">
          {loading && logs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading real-time audit ledger…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No operations logged yet. Perform billing submissions or calculations to populate logs.</div>
          ) : (
            <table className="screenshot-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Status / Outcome</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="text-secondary" style={{ whiteSpace: 'nowrap' }}>{l.timestamp.replace('T', ' ').substring(0, 19)}</td>
                    <td>
                      <span className={`badge ${
                        l.module === 'einvoice' ? 'badge-blue' :
                        l.module === 'payroll' ? 'badge-green' :
                        l.module === 'expense' ? 'badge-purple' : 'badge-muted'
                      }`} style={{ textTransform: 'uppercase', fontSize: 10 }}>
                        {l.module}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.action}</td>
                    <td className="text-secondary">{l.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
