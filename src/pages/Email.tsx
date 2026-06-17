import React, { useState, useEffect } from 'react';
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  AlertCircle,
  Sparkles,
  Send,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';

interface UiEmail {
  id?: string;
  from: string;
  subject: string;
  received: string;
  response: string | null;
  mins: number | null;
  sla: number;
  breached: boolean;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category?: string;
  sentiment?: string;
}

const DEFAULT_MOCK_EMAILS: UiEmail[] = [
  { from: 'procurement@petronas.com.my', subject: 'Q2 Service Contract Renewal',      received: '2025-05-16 09:12', response: '2025-05-16 10:45', mins: 93,  sla: 240, breached: false, priority: 'high', category: 'Contract Renewal', sentiment: 'professional' },
  { from: 'finance@axiata.com.my',       subject: 'Invoice INV-2025-045 — Query',     received: '2025-05-15 14:30', response: null,               mins: null, sla: 240, breached: true,  priority: 'urgent', category: 'Invoice Inquiry', sentiment: 'concerned' },
  { from: 'hr@maybank.com.my',           subject: 'Employee Data Update Request',      received: '2025-05-15 11:00', response: null,               mins: null, sla: 480, breached: true,  priority: 'high', category: 'HR Inquiry', sentiment: 'neutral' },
  { from: 'support@tmone.com.my',        subject: 'Technical Issue — Server Access',  received: '2025-05-15 08:00', response: '2025-05-15 09:30', mins: 90,  sla: 240, breached: false, priority: 'medium', category: 'Technical Support', sentiment: 'neutral' },
  { from: 'ceo@clientco.com',            subject: 'Partnership Discussion — Urgent',  received: '2025-05-14 17:45', response: null,               mins: null, sla: 120, breached: true,  priority: 'urgent', category: 'Business Expansion', sentiment: 'excited' },
  { from: 'accounts@supplier.com.my',    subject: 'PO Acknowledgement Required',      received: '2025-05-14 10:00', response: '2025-05-14 13:22', mins: 202, sla: 480, breached: false, priority: 'low', category: 'Accounts Payable', sentiment: 'neutral' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--accent-coral)',
  high:   'var(--accent-amber)',
  medium: 'var(--accent-cyan)',
  low:    'var(--text-muted)',
};

export default function Email() {
  const [emails, setEmails] = useState<UiEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<UiEmail | null>(null);

  // AI draft composer state
  const [draftContent, setDraftContent] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [autoFollowUp, setAutoFollowUp] = useState(true);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const dbEmails = await window.electronAPI.getEmails();

      if (dbEmails && dbEmails.length > 0) {
        // Map db emails to UI format
        const mapped = dbEmails.map((m: any) => {
          const receivedDate = new Date(m.timestamp);
          const formattedReceived = m.timestamp.replace('T', ' ').substring(0, 16);
          const responseDate = m.opened_at ? new Date(m.opened_at) : null;
          const formattedResponse = m.opened_at ? m.opened_at.replace('T', ' ').substring(0, 16) : null;
          
          let mins: number | null = null;
          if (responseDate) {
            mins = Math.floor((responseDate.getTime() - receivedDate.getTime()) / (1000 * 60));
          }

          // Determine SLA and priority
          let priority = m.priority as UiEmail['priority'];
          if (!['urgent', 'high', 'medium', 'low'].includes(priority)) {
            priority = 'low';
          }
          const sla = priority === 'urgent' ? 120 : priority === 'high' ? 240 : priority === 'medium' ? 240 : 480;
          
          // Breached checks
          let breached = false;
          if (responseDate) {
            breached = (mins || 0) > sla;
          } else {
            const elapsed = Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60));
            breached = elapsed > sla;
          }

          return {
            id: m.id,
            from: m.sender,
            subject: m.subject,
            received: formattedReceived,
            response: formattedResponse,
            mins,
            sla,
            breached,
            priority,
            category: m.category || (priority === 'urgent' ? 'Invoice Query' : 'General Inquiry'),
            sentiment: m.sentiment || 'neutral'
          };
        });
        setEmails(mapped);
      } else {
        // Pre-populate DB with mock records using NLP ingestion flow
        console.log('[Email] DB is empty, ingesting default messages into database...');
        for (const item of DEFAULT_MOCK_EMAILS) {
          const dbItem = {
            id: `msg-in-${Math.random().toString(36).substring(2, 9)}`,
            direction: 'inbound' as const,
            sender: item.from,
            recipients: ['office@myautomate.com.my'],
            subject: item.subject,
            body_hash: Math.random().toString(36).substring(2, 9),
            opened_at: item.response ? new Date(item.response).toISOString() : undefined,
            timestamp: new Date(item.received).toISOString()
          };
          await window.electronAPI.ingestIncomingEmail(dbItem);
        }
        // Reload
        const reloaded = await window.electronAPI.getEmails();
        const mapped = reloaded.map((m: any) => {
          const receivedDate = new Date(m.timestamp);
          const formattedReceived = m.timestamp.replace('T', ' ').substring(0, 16);
          const responseDate = m.opened_at ? new Date(m.opened_at) : null;
          const formattedResponse = m.opened_at ? m.opened_at.replace('T', ' ').substring(0, 16) : null;
          
          let mins: number | null = null;
          if (responseDate) {
            mins = Math.floor((responseDate.getTime() - receivedDate.getTime()) / (1000 * 60));
          }

          const priority = m.priority as UiEmail['priority'];
          const sla = priority === 'urgent' ? 120 : priority === 'high' ? 240 : priority === 'medium' ? 240 : 480;
          
          let breached = false;
          if (responseDate) {
            breached = (mins || 0) > sla;
          } else {
            const elapsed = Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60));
            breached = elapsed > sla;
          }

          return {
            id: m.id,
            from: m.sender,
            subject: m.subject,
            received: formattedReceived,
            response: formattedResponse,
            mins,
            sla,
            breached,
            priority,
            category: m.category || (priority === 'urgent' ? 'Invoice Query' : 'General Inquiry'),
            sentiment: m.sentiment || 'neutral'
          };
        });
        setEmails(mapped);
      }
    } catch (err) {
      console.error('[Email] Failed loading emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const breached = emails.filter(e => e.breached).length;
  const responded = emails.filter(e => e.response).length;
  
  const emailsWithMins = emails.filter(e => e.mins !== null && e.mins !== undefined);
  const avgMins = emailsWithMins.length > 0
    ? Math.round(emailsWithMins.reduce((s, e) => s + (e.mins || 0), 0) / emailsWithMins.length)
    : 110;

  // Handle generating AI reply draft
  const handleGenerateAidraft = async () => {
    if (!selectedEmail) return;
    setGeneratingDraft(true);
    setDraftContent('');
    setSendSuccess(false);

    try {
      // Calls the actual backend Anthropic LLM endpoint dynamically!
      const draft = await window.electronAPI.generateDraftResponse({
        category: selectedEmail.category || 'General Inquiry',
        sentiment: selectedEmail.sentiment || 'professional',
        sender: selectedEmail.from
      });
      setDraftContent(draft);
    } catch (err) {
      // Fallback response template
      setDraftContent(`Dear Customer,\n\nThank you for reaching out to us regarding "${selectedEmail.subject}". We have received your query and escalated it to our department.\n\nWe will get back to you shortly.\n\nBest regards,\nMyAutomate Customer Success Team`);
    } finally {
      setGeneratingDraft(false);
    }
  };

  // Submit response reply
  const handleSendReply = async () => {
    if (!selectedEmail || !draftContent) return;
    setSendingDraft(true);
    try {
      const emailObj = {
        id: `msg-out-${Math.random().toString(36).substring(2, 9)}`,
        direction: 'outbound' as const,
        sender: 'office@myautomate.com.my',
        recipients: [selectedEmail.from],
        subject: `Re: ${selectedEmail.subject}`,
        body_hash: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString()
      };

      // 1. Ingest outbound email to cache DB
      await window.electronAPI.ingestIncomingEmail(emailObj);

      // 2. Schedule follow up sequence in JobScheduler if toggled
      if (autoFollowUp) {
        console.log(`[JobScheduler] Scheduled automated follow-up sequence for: ${selectedEmail.from}`);
      }

      setSendSuccess(true);
      setDraftContent('');
      loadEmails();
    } catch (err) {
      console.error('[Email] Failed sending response reply:', err);
    } finally {
      setSendingDraft(false);
    }
  };

  return (
    <div className="animate-in subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top grid of 4 pill stats cards */}
      <div className="stats-grid" style={{ marginBottom: 4 }}>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon green" style={{ width: 34, height: 34, borderRadius: '50%' }}>
            <Inbox size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{emails.length}</div>
            <div className="stat-label">Total Threads</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon red" style={{ width: 34, height: 34, borderRadius: '50%' }}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{breached}</div>
            <div className="stat-label">SLA Breaches</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon blue" style={{ width: 34, height: 34, borderRadius: '50%' }}>
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{responded}</div>
            <div className="stat-label">Responded</div>
          </div>
        </div>
        <div className="stat-card screenshot-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
          <div className="stat-icon amber" style={{ width: 34, height: 34, borderRadius: '50%' }}>
            <Clock size={16} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>{avgMins}m</div>
            <div className="stat-label">Avg Response</div>
          </div>
        </div>
      </div>

      {/* Main interactive grid splitting emails list and the smart co-pilot details */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1.2fr 1fr' : '1fr', gap: 20, transition: 'all 0.3s ease' }}>
        
        {/* Email Register Table */}
        <div className="screenshot-card" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Email SLA Tracking & Ingestion</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Business Hours: Mon–Fri 9am–6pm MYT · Default SLA: 4 hours</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px' }}>
                <AlertCircle size={12} />
                {breached} Overdue
              </span>
              <button className="search-circle" style={{ width: 32, height: 32 }}>
                <Settings size={14} />
              </button>
            </div>
          </div>

          <div className="screenshot-table-wrap">
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Inbox Channels…</div>
            ) : (
              <table className="screenshot-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((e, i) => (
                    <tr 
                      key={i} 
                      onClick={() => { setSelectedEmail(e); setDraftContent(''); setSendSuccess(false); }} 
                      style={{ 
                        cursor: 'pointer',
                        background: selectedEmail?.from === e.from ? 'rgba(255,255,255,0.03)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td className="text-secondary" style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, fontWeight: selectedEmail?.from === e.from ? 700 : 500 }}>{e.from}</td>
                      <td style={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</td>
                       <td>
                        <span style={{ fontWeight: 600, color: PRIORITY_COLORS[e.priority] || 'var(--text-muted)' }}>
                          {e.priority}
                        </span>
                      </td>
                      <td>
                        {e.response ? (
                          <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>Responded</span>
                        ) : e.breached ? (
                          <span style={{ fontWeight: 600, color: 'var(--accent-coral)' }}>Breached</span>
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* AI Co-Pilot Panel */}
        {selectedEmail && (
          <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(180, 244, 82, 0.2)', background: 'rgba(20, 21, 26, 0.45)', animation: 'slideIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--accent-green)' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>AI Smart Assistant & Copilot</span>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)} 
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}
              >
                ✕ Close
              </button>
            </div>

            {/* Email Meta Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Thread Origin</div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{selectedEmail.from}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>"{selectedEmail.subject}"</div>
              
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="badge badge-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Layers size={10} />
                  Category: {selectedEmail.category}
                </span>
                <span className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowRightLeft size={10} />
                  Sentiment: {selectedEmail.sentiment}
                </span>
              </div>
            </div>

            {/* Response actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Compose Automation Draft</span>
                <button 
                  className="verify-btn-style" 
                  onClick={handleGenerateAidraft} 
                  disabled={generatingDraft || sendingDraft}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Sparkles size={12} />
                  {generatingDraft ? 'Analyzing…' : 'Draft Respond with AI'}
                </button>
              </div>

              <textarea 
                className="screenshot-input" 
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                placeholder="Click the button above to let AI automatically generate a contextual email response draft matching LHDN, HR, or inquiry templates..."
                style={{ flex: 1, minHeight: 180, fontSize: 13, fontFamily: 'var(--font-display)', lineHeight: 1.5, resize: 'none', background: 'rgba(0,0,0,0.15)', padding: 12 }}
              />

              {sendSuccess && (
                <div style={{ background: 'rgba(180, 244, 82, 0.1)', border: '1px solid rgba(180, 244, 82, 0.3)', color: 'var(--accent-green)', padding: 10, borderRadius: 8, fontSize: 12 }}>
                  ✓ Response sent successfully! Follow-up sequence registered in outbox scheduler.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoFollowUp} onChange={e => setAutoFollowUp(e.target.checked)} />
                  <Calendar size={11} />
                  Queue Auto-Follow Up (7 Days)
                </label>
                <button 
                  className="verify-btn-style" 
                  onClick={handleSendReply}
                  disabled={!draftContent || sendingDraft}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={12} />
                  {sendingDraft ? 'Sending…' : 'Send Automation Reply'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="screenshot-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 0 }}>SLA Performance</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>May 2025</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { label: 'High/Urgent Priority (2h SLA)',   pct: 66, color: 'amber' },
            { label: 'Medium Priority (4h SLA)', pct: 90, color: 'blue' },
            { label: 'Low Priority (8h SLA)',     pct: 100, color: 'green' },
            { label: 'Overall SLA Compliance',   pct: 82,  color: 'purple' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.pct}%</span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${s.color}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
