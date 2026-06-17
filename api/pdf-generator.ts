import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { BatikInvoice } from '../src/db/types';

export type PdfTheme = 'normal' | 'white';

function prepareInvoiceData(invoice: BatikInvoice) {
  const isReceipt = invoice.status === 'paid';
  const documentTitle = isReceipt ? 'Official Receipt' : 'Commercial Invoice';
  const documentId = isReceipt ? invoice.id.replace(/^INV-/, 'REC-') : invoice.id;
  const subtotalStr = (invoice.subtotal || 0).toFixed(2);
  const discountStr = (invoice.discount_amount || 0).toFixed(2);
  const totalStr = (invoice.total || 0).toFixed(2);
  const dateStr = new Date(invoice.created_at).toLocaleDateString('en-MY', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const statusStr = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
  const hasDiscount = invoice.discount_type !== 'none';
  const discountLabel = invoice.discount_type === 'percentage'
    ? `${invoice.discount_value}%`
    : 'Fixed Amount';

  return {
    isReceipt,
    documentTitle,
    documentId,
    subtotalStr,
    discountStr,
    totalStr,
    dateStr,
    statusStr,
    hasDiscount,
    discountLabel,
  };
}

function buildNormalThemeHtml(invoice: BatikInvoice): string {
  const d = prepareInvoiceData(invoice);

  const itemsHtml = invoice.items.map((item, idx) => `
    <tr class="item-row ${idx % 2 === 1 ? 'alt' : ''}">
      <td class="col-desc">
        <span class="fabric-type">${item.fabric_type}</span>
        ${item.pattern_name ? `<span class="pattern-name">${item.pattern_name}</span>` : ''}
      </td>
      <td class="col-qty">${(item.quantity_meters || 0).toFixed(1)} m</td>
      <td class="col-price">RM ${(item.price_per_meter || 0).toFixed(2)}</td>
      <td class="col-total">RM ${(item.total || ((item.quantity_meters || 0) * (item.price_per_meter || 0)) || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRowHtml = d.hasDiscount
    ? `<div class="summary-line">
         <span class="sum-label">Discount (${d.discountLabel}):</span>
         <span class="sum-value">- RM ${d.discountStr}</span>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Antara Batik - ${invoice.id}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #1a1410;
      color: #d4cfc9;
      padding: 40px;
      font-size: 11px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
    }
    .invoice-card { max-width: 800px; margin: 0 auto; background-color: #1a1410; position: relative; }
    .gold-bar {
      height: 4px;
      background: linear-gradient(90deg, #cfab6d, #ebd09c, #cfab6d);
      margin-bottom: 30px;
      border-radius: 2px;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand-logo-area { display: flex; flex-direction: column; }
    .brand-name {
      font-family: 'Outfit', sans-serif;
      font-size: 26px; font-weight: 700;
      letter-spacing: 0.1em;
      color: #cfab6d;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .brand-tagline {
      font-family: 'Outfit', sans-serif;
      font-size: 12px; color: #ebd09c;
      letter-spacing: 0.05em;
      margin-bottom: 12px; font-weight: 500;
    }
    .brand-details { font-size: 9px; color: #d4cfc9; line-height: 1.6; }
    .doc-details { text-align: right; }
    .doc-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22px; font-weight: 600;
      color: #cfab6d; letter-spacing: 0.02em; margin-bottom: 15px;
    }
    .meta-grid { display: grid; grid-template-columns: auto auto; gap: 4px 15px; text-align: left; font-size: 10px; }
    .meta-label { color: #ebd09c; font-weight: 500; }
    .meta-val { color: #ffffff; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; }
    .addresses-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 45px; }
    .address-box {
      background-color: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px; padding: 20px;
    }
    .address-box h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 12px; color: #cfab6d;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 8px;
    }
    .address-text { font-size: 10px; color: #d4cfc9; line-height: 1.6; }
    .address-name { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; color: #ffffff; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th {
      font-family: 'Outfit', sans-serif;
      font-weight: 600; font-size: 12px;
      letter-spacing: 0.01em; color: #ebd09c;
      background-color: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 12px 14px; text-align: left;
    }
    td { padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
    .item-row.alt { background-color: rgba(255,255,255,0.01); }
    .col-desc { display: flex; flex-direction: column; }
    .fabric-type { font-family: 'Outfit', sans-serif; font-weight: 600; color: #ffffff; font-size: 12px; }
    .pattern-name { font-size: 9.5px; color: #ebd09c; margin-top: 3px; }
    .col-qty { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: #ffffff; }
    .col-price { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: #d4cfc9; }
    .col-total { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11.5px; font-weight: 600; color: #cfab6d; text-align: right; }
    th:last-child { text-align: right; }
    .totals-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
    .notes-container {
      width: 50%;
      background-color: rgba(255,255,255,0.015);
      border-left: 2px solid #cfab6d;
      padding: 18px; border-radius: 0 8px 8px 0;
    }
    .notes-title { font-family: 'Outfit', sans-serif; font-size: 11.5px; color: #ebd09c; margin-bottom: 8px; }
    .notes-body { font-size: 10px; color: #d4cfc9; line-height: 1.6; }
    .summary-container { width: 40%; display: flex; flex-direction: column; gap: 10px; }
    .summary-line { display: flex; justify-content: space-between; font-size: 11px; }
    .summary-line.grand-total {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 12px; margin-top: 6px;
    }
    .sum-label { color: #d4cfc9; }
    .sum-value { font-family: 'Plus Jakarta Sans', sans-serif; color: #ffffff; }
    .sum-label.grand { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; color: #cfab6d; }
    .sum-value.grand { font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: #cfab6d; }
    .footer-section { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 35px; text-align: center; }
    .footer-left { font-family: 'Outfit', sans-serif; font-size: 10px; color: #d4cfc9; opacity: 0.45; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="gold-bar"></div>
    <div class="header">
      <div class="brand-logo-area">
        <span class="brand-name">ANTARA BATIK</span>
        <span class="brand-tagline">Antara Studio (NS0322739-K)</span>
        <div class="brand-details">
          No. 6, Jalan Wangsa Perdana 1<br/>
          53300 Kuala Lumpur<br/>
          Tel: +6019-988 7272 | +6011-6179 9873
        </div>
      </div>
      <div class="doc-details">
        <div class="doc-title">${d.documentTitle}</div>
        <div class="meta-grid">
          <span class="meta-label">Document ID:</span>
          <span class="meta-val">${d.documentId}</span>
          <span class="meta-label">Date Generated:</span>
          <span class="meta-val">${d.dateStr}</span>
          <span class="meta-label">Payment Status:</span>
          <span class="meta-val">${d.statusStr}</span>
        </div>
      </div>
    </div>

    <div class="addresses-row">
      <div class="address-box">
        <h3>Billed to (Customer)</h3>
        <div class="address-name">${invoice.customer_name}</div>
        <div class="address-text">
          ${invoice.customer_address ? invoice.customer_address.replace(/\n/g, '<br/>') : 'No address provided.'}<br/><br/>
          <strong>Phone:</strong> ${invoice.customer_phone}<br/>
          ${invoice.customer_email ? `<strong>Email:</strong> ${invoice.customer_email}` : ''}
        </div>
      </div>
      <div class="address-box">
        <h3>Payment &amp; Terms</h3>
        <div class="address-text">
          <strong>Method:</strong> Bank Transfer / FPX Direct<br/>
          <strong>Banker:</strong> Hong Leong Bank<br/>
          <strong>Account No:</strong> 39501284728<br/>
          <strong>Account Name:</strong> Antara Studio<br/><br/>
          ${d.isReceipt
            ? 'Thank you for your business! Payment has been successfully verified and completed.'
            : '<strong>Due Date:</strong> Net 7 Days from Invoice Date.'}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Fabric Product</th>
          <th style="width:15%">Quantity</th>
          <th style="width:20%">Unit Price</th>
          <th style="width:20%; text-align:right">Total Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals-section">
      <div class="notes-container">
        <div class="notes-title">Notice &amp; Material Note</div>
        <div class="notes-body">
          Our materials and designs are among the best in the market. Thank you for choosing us — may the batik bring happiness to you and everyone around.<br/><br/>
          All invoices must be settled in Malaysian Ringgit. Cut meters are not accepted.
        </div>
      </div>
      <div class="summary-container">
        <div class="summary-line">
          <span class="sum-label">Subtotal:</span>
          <span class="sum-value">RM ${d.subtotalStr}</span>
        </div>
        ${discountRowHtml}
        <div class="summary-line grand-total">
          <span class="sum-label grand">Total ${d.isReceipt ? 'Paid' : 'Due'}:</span>
          <span class="sum-value grand">RM ${d.totalStr}</span>
        </div>
      </div>
    </div>

    <div class="footer-section">
      <div class="footer-left">
        Generated digitally via Antara Batik Automation.<br/>
        Thank you for supporting Malaysian heritage and traditional artisans.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildWhiteThemeHtml(invoice: BatikInvoice): string {
  const d = prepareInvoiceData(invoice);

  const itemsHtml = invoice.items.map((item, idx) => `
    <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
      <td class="td-desc">
        <strong>${item.fabric_type}</strong>
        ${item.pattern_name ? `<br/><span class="pattern-sub">${item.pattern_name}</span>` : ''}
      </td>
      <td class="td-num">${(item.quantity_meters || 0).toFixed(1)} m</td>
      <td class="td-num">RM ${(item.price_per_meter || 0).toFixed(2)}</td>
      <td class="td-num td-right">RM ${(item.total || ((item.quantity_meters || 0) * (item.price_per_meter || 0)) || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRowHtml = d.hasDiscount
    ? `<tr class="summary-row">
         <td class="summary-label">Discount (${d.discountLabel})</td>
         <td class="summary-val discount-val">− RM ${d.discountStr}</td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Antara Batik - ${invoice.id} (White Theme)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      padding: 48px;
      font-size: 11px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 28px;
      border-bottom: 2px solid #1a1a2e;
      margin-bottom: 36px;
    }
    .brand-col { display: flex; flex-direction: column; gap: 4px; }
    .brand-name {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .brand-reg {
      font-size: 10px;
      color: #666;
      font-weight: 400;
      letter-spacing: 0.02em;
    }
    .brand-contact {
      margin-top: 10px;
      font-size: 9.5px;
      color: #555;
      line-height: 1.7;
    }
    .doc-col { text-align: right; }
    .doc-type-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
    }
    .doc-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 16px;
    }
    .meta-table { font-size: 10px; text-align: left; }
    .meta-table td { padding: 2px 0 2px 20px; color: #333; }
    .meta-table .ml { font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em; padding-left: 0; }
    .status-text { font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 40px;
    }
    .address-block h4 {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e0e0e0;
    }
    .address-name { font-size: 12px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .address-body { font-size: 10px; color: #555; line-height: 1.7; }
    .address-body strong { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table-wrap { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; margin-bottom: 28px; }
    thead tr { background: #f5f5f5; }
    th {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #555;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    td { padding: 12px 14px; border-bottom: 1px solid #f0f0f0; color: #333; vertical-align: middle; }
    .row-alt { background: #fafafa; }
    tbody tr:last-child td { border-bottom: none; }
    .td-desc { font-size: 11px; color: #1a1a2e; }
    .pattern-sub { font-size: 9px; color: #888; font-style: italic; }
    .td-num { font-size: 11px; font-variant-numeric: tabular-nums; }
    .td-right { text-align: right; font-weight: 600; color: #1a1a2e; }
    th:last-child { text-align: right; }
    .totals-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 44px;
      gap: 32px;
    }
    .notes-block {
      flex: 1;
      background: #fafafa;
      border-left: 3px solid #1a1a2e;
      padding: 16px 18px;
      border-radius: 0 4px 4px 0;
    }
    .notes-block h4 {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
    }
    .notes-block p { font-size: 10px; color: #555; line-height: 1.65; }
    .summary-block { min-width: 260px; }
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-row td { padding: 6px 10px; font-size: 11px; }
    .summary-label { color: #666; text-align: left; border-top: none; }
    .summary-val { text-align: right; font-weight: 500; color: #1a1a2e; font-variant-numeric: tabular-nums; }
    .discount-val { color: #c62828; }
    .grand-row td { padding: 10px 10px; border-top: 2px solid #1a1a2e; margin-top: 4px; }
    .grand-label { font-size: 13px; font-weight: 700; color: #1a1a2e; }
    .grand-val { font-size: 15px; font-weight: 700; color: #1a1a2e; text-align: right; font-variant-numeric: tabular-nums; }
    .footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
      text-align: center;
      font-size: 9px;
      color: #aaa;
      line-height: 1.8;
    }
    .footer strong { color: #888; }
    .receipt-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-family: 'Outfit', sans-serif;
      font-size: 80px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.035);
      letter-spacing: 0.15em;
      pointer-events: none;
      z-index: 0;
      user-select: none;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  ${d.isReceipt ? '<div class="receipt-watermark">PAID</div>' : ''}

  <div class="header">
    <div class="brand-col">
      <div class="brand-name">Antara Batik</div>
      <div class="brand-reg">Antara Studio (NS0322739-K)</div>
      <div class="brand-contact">
        No. 6, Jalan Wangsa Perdana 1, 53300 Kuala Lumpur<br/>
        Tel: +6019-988 7272 | +6011-6179 9873
      </div>
    </div>
    <div class="doc-col">
      <div class="doc-type-label">${d.documentTitle}</div>
      <div class="doc-title">${d.documentId}</div>
      <table class="meta-table">
        <tr>
          <td class="ml">Date</td>
          <td>${d.dateStr}</td>
        </tr>
        <tr>
          <td class="ml">Status</td>
          <td class="status-text" style="color: ${d.isReceipt ? '#2e7d32' : '#c62828'}">${d.statusStr}</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="address-grid">
    <div class="address-block">
      <h4>Billed To</h4>
      <div class="address-name">${invoice.customer_name}</div>
      <div class="address-body">
        ${invoice.customer_address ? invoice.customer_address.replace(/\n/g, '<br/>') : 'No address provided.'}<br/><br/>
        <strong>Phone:</strong> ${invoice.customer_phone}<br/>
        ${invoice.customer_email ? `<strong>Email:</strong> ${invoice.customer_email}` : ''}
      </div>
    </div>
    <div class="address-block">
      <h4>Payment &amp; Terms</h4>
      <div class="address-body">
        <strong>Method:</strong> Bank Transfer / FPX Direct<br/>
        <strong>Banker:</strong> Hong Leong Bank<br/>
        <strong>Account No:</strong> 39501284728<br/>
        <strong>Account Name:</strong> Antara Studio<br/><br/>
        ${d.isReceipt
          ? 'Thank you for your business! Payment has been successfully verified and completed.'
          : '<strong>Due Date:</strong> Net 7 Days from Invoice Date.'}
      </div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Fabric Product</th>
          <th style="width:15%">Quantity</th>
          <th style="width:20%">Unit Price</th>
          <th style="width:20%; text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <div class="totals-area">
    <div class="notes-block">
      <h4>Notes &amp; Terms</h4>
      <p>
        Our materials and designs are among the best in the market. Thank you for choosing us —
        may the batik bring happiness to you and everyone around.<br/><br/>
        All invoices must be settled in Malaysian Ringgit. Cut meters are not accepted.
      </p>
    </div>
    <div class="summary-block">
      <table class="summary-table">
        <tbody>
          <tr class="summary-row">
            <td class="summary-label">Subtotal</td>
            <td class="summary-val">RM ${d.subtotalStr}</td>
          </tr>
          ${discountRowHtml}
          <tr class="grand-row">
            <td class="grand-label">Total ${d.isReceipt ? 'Paid' : 'Due'}</td>
            <td class="grand-val">RM ${d.totalStr}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <strong>Antara Studio (NS0322739-K)</strong> &nbsp;·&nbsp; No. 6, Jalan Wangsa Perdana 1, 53300 Kuala Lumpur<br/>
    Generated digitally via Antara Batik Automation &nbsp;·&nbsp; Thank you for supporting Malaysian heritage and traditional artisans.
  </div>
</body>
</html>`;
}

function buildHtmlForTheme(invoice: BatikInvoice, theme: PdfTheme): string {
  switch (theme) {
    case 'white':
      return buildWhiteThemeHtml(invoice);
    case 'normal':
    default:
      return buildNormalThemeHtml(invoice);
  }
}

export async function generatePdfBuffer(
  invoice: BatikInvoice,
  theme: PdfTheme = 'normal'
): Promise<Buffer> {
  const htmlContent = buildHtmlForTheme(invoice, theme);
  
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();

  return Buffer.from(pdfBuffer);
}
