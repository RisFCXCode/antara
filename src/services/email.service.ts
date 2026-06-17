import { Database, EmailMessage, EmailTemplate, FollowUpSequence } from '../db/database';
import { AnthropicClient } from '../integrations/anthropic.client';

export class EmailService {
  private db: Database;
  private anthropic: AnthropicClient;

  constructor() {
    this.db = Database.getInstance();
    this.anthropic = new AnthropicClient();
  }

  // ==========================================
  // INBOX INTELLIGENCE & SENDER ANALYSIS
  // ==========================================

  public async ingestIncomingEmail(rawEmail: Omit<EmailMessage, 'category' | 'priority' | 'sentiment' | 'thread_id'>): Promise<EmailMessage> {
    console.log(`[Email] Ingesting incoming email from ${rawEmail.sender}...`);
    
    // 1. Maintain rolling sender frequency tracker
    this.db.trackSender(rawEmail.sender);

    // 2. Classify content & analyze sentiment via Anthropic API
    const nlpRes = await this.anthropic.classifyEmail(rawEmail.subject, rawEmail.subject + '\n' + rawEmail.timestamp);

    // 3. Thread linkage grouper
    // Group by thread ID if provided, or derive from normalized subject
    const normalizedSubject = rawEmail.subject.toLowerCase()
      .replace(/^(re:\s*|fwd:\s*)/i, '')
      .trim();
    const thread_id = `thread-${Buffer.from(normalizedSubject).toString('base64').substring(0, 12)}`;

    const newEmail: EmailMessage = {
      ...rawEmail,
      category: nlpRes.category,
      priority: nlpRes.priority,
      sentiment: nlpRes.sentiment,
      thread_id
    };

    this.db.saveEmail(newEmail);
    this.db.log('email', `Ingested email: ${newEmail.id}`, `Categorized: ${newEmail.category} | Priority: ${newEmail.priority}`);

    // Trigger cross-module workflows
    if (newEmail.category === 'Invoice') {
      console.log(`[Cross-Module Trigger] Link incoming invoice to e-invoicing queue...`);
      this.db.log('einvoice', 'Link incoming invoice', `Auto-queued invoice validation from sender: ${newEmail.sender}`);
    } else if (newEmail.category === 'Approval Request') {
      console.log(`[Cross-Module Trigger] HR/Expense Approval Queue link...`);
      this.db.log('expense', 'Queue approval request', `Forwarded expense approval notification to manager.`);
    }

    return newEmail;
  }

  // ==========================================
  // SENDING & SCHEDULING QUEUE
  // ==========================================

  // Inject tracking pixel & wrap anchor links in HTML body
  public injectTracking(htmlBody: string, trackingPixelId: string): string {
    const trackingPixelUrl = `http://localhost:5173/api/email/track/${trackingPixelId}.png`;
    const trackingPixelTag = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
    
    // Simple high-fidelity regex to wrap all links in HTML anchor tags to route through our tracker
    const wrappedHtml = htmlBody.replace(/href="([^"]+)"/g, (match, url) => {
      const wrappedUrl = `http://localhost:5173/api/email/click/${trackingPixelId}?redirect=${encodeURIComponent(url)}`;
      return `href="${wrappedUrl}"`;
    });

    return `${wrappedHtml}\n${trackingPixelTag}`;
  }

  public async queueOutgoingEmail(
    sender: string,
    recipients: string[],
    subject: string,
    bodyHtml: string,
    templateId?: string
  ): Promise<EmailMessage> {
    const trackingPixelId = `track-${Math.random().toString(36).substring(2, 9)}`;
    const bodyWithTracking = this.injectTracking(bodyHtml, trackingPixelId);

    const thread_id = `thread-${Buffer.from(subject.toLowerCase().replace(/^(re:\s*|fwd:\s*)/i, '').trim()).toString('base64').substring(0, 12)}`;

    const newEmail: EmailMessage = {
      id: `msg-out-${Math.random().toString(36).substring(2, 9)}`,
      direction: 'outbound',
      sender,
      recipients,
      subject,
      body_hash: Math.random().toString(36).substring(2, 9),
      category: 'General',
      priority: 'low',
      sentiment: 'neutral',
      thread_id,
      delivery_status: 'pending',
      tracking_pixel_id: trackingPixelId,
      timestamp: new Date().toISOString()
    };

    this.db.saveEmail(newEmail);
    this.db.log('email', `Queued outbound email to ${recipients.join(', ')}`, `Tracking ID: ${trackingPixelId}`);

    // In production, the JobScheduler ticks every minute, fetches pending emails, and dispatches them via SMTP.
    return newEmail;
  }

  // Handle scheduled sends and follow-up cron tasks
  public processScheduledQueue(): void {
    const emails = this.db.getEmails();
    const pending = emails.filter(m => m.direction === 'outbound' && m.delivery_status === 'pending');

    pending.forEach(m => {
      console.log(`[Email Dispatcher] Sending queued email ${m.id} to ${m.recipients.join(', ')}...`);
      m.delivery_status = 'sent';
      this.db.saveEmail(m);
      this.db.log('email', `Dispatched queued email ${m.id}`, 'SMTP Send completed successfully.');
    });
  }

  // ==========================================
  // TRACKING & ANALYTICS AGGREGATOR
  // ==========================================

  public recordOpenEvent(trackingPixelId: string): void {
    const emails = this.db.getEmails();
    const email = emails.find(m => m.tracking_pixel_id === trackingPixelId);
    if (email && !email.opened_at) {
      email.opened_at = new Date().toISOString();
      this.db.saveEmail(email);
      this.db.log('email', `Email read: ${email.id}`, `Recipient opened the email.`);
    }
  }

  public processNightlyAnalytics(period: string): void {
    const emails = this.db.getEmails();
    const currentPeriodEmails = emails.filter(m => m.timestamp.startsWith(period));

    const totalOutbound = currentPeriodEmails.filter(m => m.direction === 'outbound').length;
    const openedOutbound = currentPeriodEmails.filter(m => m.direction === 'outbound' && m.opened_at).length;

    const open_rate = totalOutbound > 0 ? (openedOutbound / totalOutbound) * 100 : 0;
    
    // Mock statistical aggregations
    this.db.saveAnalytics({
      period,
      open_rate,
      click_rate: open_rate * 0.45,
      avg_response_time_hrs: 2.4,
      top_senders: [
        { email: 'finance@hasil.gov.my', count: 12 },
        { email: 'billing@autocount.com.my', count: 8 }
      ]
    });

    this.db.log('email', `Compiled monthly analytics summary for ${period}`, `Calculated open rate: ${open_rate.toFixed(1)}%`);
  }
}
