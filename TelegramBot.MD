# Antara Batik — Telegram Invoice & Receipt Automation
## Technical Design & Implementation Spec
### v3.0 — Electron PDF Reuse + Multi-Fabric Support

> **Authored by:** Lead Architect (Senior Full Stack — 30 Years Experience)
> **Scope:** Telegram Bot Integration · Electron PDF Reuse · Multi-Fabric Orders
> **Status:** Ready for Development Sprint
> **Supersedes:** v2.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Design Mandate — Electron PDF Reuse](#2-critical-design-mandate--electron-pdf-reuse)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Component Breakdown](#4-component-breakdown)
5. [Telegram Bot — Full Flow Design (Multi-Fabric)](#5-telegram-bot--full-flow-design-multi-fabric)
6. [Desktop App — Processing Engine](#6-desktop-app--processing-engine)
7. [Electron PDF Renderer — Integration Contract](#7-electron-pdf-renderer--integration-contract)
8. [Multi-Fabric Order Structure](#8-multi-fabric-order-structure)
9. [API Contract (Bot ↔ Desktop)](#9-api-contract-bot--desktop)
10. [Pricing & Discount Logic](#10-pricing--discount-logic)
11. [Database Schema](#11-database-schema)
12. [Session State Management](#12-session-state-management)
13. [Error Handling & Validation](#13-error-handling--validation)
14. [Security Considerations](#14-security-considerations)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Team Task Allocation](#16-team-task-allocation)
17. [Future Scalability](#17-future-scalability)

---

## 1. Executive Summary

This document defines the complete technical design for adding **Telegram Bot integration** to the Antara Batik Business Management System. The bot serves as a clean, conversational front-end that collects invoice/receipt data from users step-by-step. The desktop app remains the single source of truth — handling all business logic, PDF rendering, document storage, and reference ID generation.

**Core Principle:**
```
Telegram Bot  =  Input collection layer (dumb terminal)
Desktop App   =  Brain + engine (all logic lives here)
```

This separation ensures the system remains modular, testable, and extensible to WhatsApp, Web, or any other channel in the future with zero changes to the core engine.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Telegram)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Chat messages
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT SERVICE                         │
│  • Conversational flow controller                               │
│  • Session state management (per user)                          │
│  • Input validation (quantity, type checks)                     │
│  • Webhook receiver from Telegram API                           │
│  • Sends collected payload → Desktop App API                    │
│  • Receives PDF back → Forwards to user                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP REST (JSON payload)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DESKTOP APP — CORE ENGINE                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ API Gateway  │  │ Pricing      │  │ Reference ID         │  │
│  │ (REST)       │  │ Engine       │  │ Generator            │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                        │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Document     │  │ PDF Renderer │  │ Database / Storage   │  │
│  │ Processor    │  │ (Branded)    │  │ (SQLite / Postgres)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                      │ PDF binary (base64 or file stream)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              TELEGRAM BOT — PDF DELIVERY                        │
│  Sends PDF document back to the originating Telegram chat       │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
              User downloads PDF ✅
```

---

## 3. Component Breakdown

### 3.1 Telegram Bot Service

| Property | Detail |
|---|---|
| Runtime | Node.js (v20+) |
| Framework | `telegraf` (recommended) or `node-telegram-bot-api` |
| Deployment | Standalone process — runs alongside desktop app |
| Communication | Webhook (preferred) or long-polling |
| State Storage | In-memory (Redis for production) per `chat_id` |

### 3.2 Desktop App API Layer

| Property | Detail |
|---|---|
| Protocol | REST over HTTP (localhost or LAN) |
| Port | `3001` (internal only, not exposed externally) |
| Auth | API key header (`X-Antara-Key`) |
| Response | JSON with PDF as base64 or download URL |

### 3.3 PDF Engine

| Property | Detail |
|---|---|
| Library | Puppeteer (HTML → PDF) or PDFKit (programmatic) |
| Brand Colors | Applied per Antara Batik PDF palette (see Section 8) |
| Font | Defined in PDF spec — consistent across all outputs |
| Output | PDF binary, stored locally + returned to bot |

---

## 4. Telegram Bot — Full Flow Design

### 4.1 Conversation State Machine

```
START
  │
  ├─► /start or /new
  │       │
  │       ▼
  │   [STEP 1] Ask: Customer Name
  │       │
  │       ▼
  │   [STEP 2] Ask: Contact Phone
  │       │
  │       ▼
  │   [STEP 3] Ask: Billing Address
  │       │
  │       ▼
  │   [STEP 4] Ask: Delivery Address
  │       │
  │       ▼
  │   [STEP 5] Ask: Email Address (optional — user can type "skip")
  │       │
  │       ▼
  │   [STEP 6] Ask: Document Type
  │             ┌─────────────────────┐
  │             │ [Invoice] [Receipt] │  ← Inline keyboard buttons
  │             └─────────────────────┘
  │       │
  │       ▼
  │   [STEP 7] Ask: Fabric Type
  │             ┌────────────────────────────────┐
  │             │ [Dubai Cotton] [Cotton Viscose] │  ← Inline keyboard buttons
  │             └────────────────────────────────┘
  │       │
  │       ▼
  │   [STEP 8] Ask: Quantity (meters)
  │             Validate: must be positive number > 0
  │       │
  │       ▼
  │   [AUTO CALCULATE]
  │       Display: Unit Price + Total Price (based on tier)
  │       │
  │       ▼
  │   [STEP 9] Ask: Apply Adjustment?
  │             ┌──────────────────────────────────┐
  │             │ [% Discount] [RM Discount] [None] │
  │             └──────────────────────────────────┘
  │       │
  │       ├─► If % or RM selected:
  │       │       Ask: Enter discount value
  │       │       Display: Recalculated total
  │       │
  │       ▼
  │   [STEP 10] Confirmation Summary
  │             Show all entered data + final total
  │             ┌────────────────────────┐
  │             │ [✅ Confirm] [✏️ Edit] │
  │             └────────────────────────┘
  │       │
  │       ├─► If Edit: Jump back to Step 1 (restart session)
  │       │
  │       ▼
  │   [PROCESSING]
  │       Bot: "⏳ Generating your document..."
  │       Sends payload → Desktop App API
  │       │
  │       ▼
  │   [DONE]
  │       Desktop App returns PDF
  │       Bot sends PDF to user
  │       Bot: "✅ Your [Invoice/Receipt] INV-XXXXXX is ready!"
  │
END
```

### 4.2 Sample Bot Conversation (UX Copy)

```
Bot:  👋 Welcome to Antara Batik!
      Let's create your document.
      
      What is the customer's full name?

User: Ahmad Razif

Bot:  📞 Contact phone number?

User: 0123456789

Bot:  🏠 Billing address?

User: No 12, Jalan Mawar, 75000 Melaka

Bot:  📦 Delivery address?
      (Type "same" to use billing address)

User: same

Bot:  📧 Email address? (Type "skip" if none)

User: skip

Bot:  Select document type:
      [Invoice]  [Receipt]

User: → taps Invoice

Bot:  Select fabric type:
      [Dubai Cotton]  [Cotton Viscose]

User: → taps Dubai Cotton

Bot:  How many meters?

User: 250

Bot:  ─────────────────────
      📊 Pricing Summary
      ─────────────────────
      Fabric:     Dubai Cotton
      Quantity:   250 meters
      Unit Price: RM 38.00/m  (100m+ tier)
      Subtotal:   RM 9,500.00
      ─────────────────────
      
      Apply an adjustment?
      [% Discount]  [RM Discount]  [No Discount]

User: → taps % Discount

Bot:  Enter discount percentage (e.g. 5 for 5%):

User: 10

Bot:  ─────────────────────
      📊 Updated Summary
      ─────────────────────
      Subtotal:   RM 9,500.00
      Discount:   10% (- RM 950.00)
      Total:      RM 8,550.00
      ─────────────────────
      
      Please confirm your order details:
      
      👤 Customer:  Ahmad Razif
      📞 Phone:     0123456789
      🏠 Billing:   No 12, Jalan Mawar, 75000 Melaka
      📦 Delivery:  Same as billing
      📧 Email:     —
      📄 Type:      Invoice
      🧵 Fabric:    Dubai Cotton
      📏 Quantity:  250 meters
      💰 Total:     RM 8,550.00

      [✅ Confirm]  [✏️ Edit]

User: → taps Confirm

Bot:  ⏳ Generating your invoice...

Bot:  ✅ Done! Here is your invoice INV-000124
      [📄 Invoice_INV-000124.pdf]
```

---

## 5. Desktop App — Processing Engine

### 5.1 Internal API Endpoints

The desktop app exposes a local REST API consumed by the Telegram bot.

#### `POST /api/documents/generate`

**Request Body:**
```json
{
  "source": "telegram",
  "telegram_chat_id": "123456789",
  "document_type": "invoice",
  "customer": {
    "name": "Ahmad Razif",
    "phone": "0123456789",
    "billing_address": "No 12, Jalan Mawar, 75000 Melaka",
    "delivery_address": "No 12, Jalan Mawar, 75000 Melaka",
    "email": null
  },
  "items": [
    {
      "fabric_type": "Dubai Cotton",
      "quantity_meters": 250,
      "unit_price": 38.00,
      "subtotal": 9500.00
    }
  ],
  "adjustment": {
    "type": "percentage",
    "value": 10,
    "amount": 950.00
  },
  "total": 8550.00
}
```

**Response Body:**
```json
{
  "success": true,
  "reference_id": "INV-000124",
  "pdf_base64": "JVBERi0xLjQKJ...",
  "pdf_filename": "Invoice_INV-000124.pdf",
  "created_at": "2025-07-15T10:32:00Z"
}
```

### 5.2 Reference ID Generation

```
Format:
  Invoice  →  INV-XXXXXX   (e.g. INV-000124)
  Receipt  →  REC-XXXXXX   (e.g. REC-000085)

Rules:
  - Sequential integer, zero-padded to 6 digits
  - Maintained separately for INV and REC series
  - Never reused — increments only
  - Stored in DB, auto-incremented on each successful generation
  - Generated by desktop app only — bot never generates IDs
```

### 5.3 Pricing Engine (Desktop App)

```
Function: calculateUnitPrice(meters)

  if meters >= 1000  →  RM 35.00
  if meters >= 500   →  RM 37.00
  if meters >= 100   →  RM 38.00
  if meters < 100    →  RM 40.00

Function: applyAdjustment(subtotal, adjustment)

  if adjustment.type === "percentage":
    discount_amount = subtotal * (adjustment.value / 100)
    total = subtotal - discount_amount

  if adjustment.type === "fixed":
    discount_amount = adjustment.value
    total = subtotal - discount_amount

  if adjustment.type === "none":
    total = subtotal

  Validation: total must never be negative
```

---

## 6. API Contract (Bot ↔ Desktop)

### 6.1 Headers

```
Content-Type:   application/json
X-Antara-Key:   <secret_api_key>
X-Source:       telegram
```

### 6.2 Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/generate` | Generate invoice or receipt PDF |
| `GET` | `/api/documents/:ref_id` | Retrieve existing document by reference ID |
| `GET` | `/api/health` | Health check — confirm desktop app is running |
| `GET` | `/api/pricing` | Return current pricing tiers (for bot validation) |

### 6.3 Error Response Format

```json
{
  "success": false,
  "error_code": "INVALID_QUANTITY",
  "message": "Quantity must be a positive number greater than 0."
}
```

**Standard Error Codes:**

| Code | Description |
|---|---|
| `INVALID_QUANTITY` | Quantity is zero, negative, or non-numeric |
| `INVALID_DISCOUNT` | Discount value out of allowed range |
| `MISSING_REQUIRED` | Required field is missing from payload |
| `PDF_RENDER_FAILED` | PDF generation encountered an error |
| `AUTH_FAILED` | API key missing or incorrect |
| `INTERNAL_ERROR` | Unexpected server error |

---

## 7. Pricing & Discount Logic

### 7.1 Pricing Tiers

| Quantity (meters) | Unit Price (RM) |
|---|---|
| 0 – 99 | 40.00 |
| 100 – 499 | 38.00 |
| 500 – 999 | 37.00 |
| 1,000 and above | 35.00 |

> **Note:** Tier is determined by **total quantity in the order**, not per-line-item.

### 7.2 Discount Rules

| Type | Input | Validation |
|---|---|---|
| Percentage | 0.01 – 100 | Reject if > 100 or ≤ 0 |
| Fixed RM | > 0 | Reject if value ≥ subtotal |
| None | — | No discount applied |

### 7.3 Calculation Order

```
1. quantity_meters × unit_price         = subtotal
2. subtotal - discount_amount           = total_after_discount
3. total_after_discount                 = final_total (displayed on PDF)
```

---

## 8. PDF Generation Spec

### 8.1 Antara Batik PDF Color Palette

> These colors are applied to PDF output ONLY. Desktop UI is unaffected.

| Role | Hex | Usage |
|---|---|---|
| Primary Background | `#1a1410` | Document background / header block |
| Secondary Background | `#2a2420` | Section dividers, table headers |
| Accent Background | `#3a3430` | Highlighted rows, totals block |
| Primary Text | `#f5f1ed` | Main body text on dark backgrounds |
| Secondary Text | `#d4cfc9` | Labels, secondary info |
| Accent Text | `#cfab6d` | Headings, reference ID, total amount |

### 8.2 PDF Layout Structure

```
┌────────────────────────────────────────────────────┐
│  [HEADER — #1a1410 bg]                             │
│  Antara Batik Logo       INVOICE / RECEIPT         │
│  Company Address         Ref: INV-000124           │
│  Contact Info            Date: 15 July 2025        │
├────────────────────────────────────────────────────┤
│  [CUSTOMER SECTION — #2a2420 bg]                   │
│  Bill To:                Ship To:                  │
│  Ahmad Razif             Ahmad Razif               │
│  0123456789              No 12, Jalan Mawar...     │
│  No 12, Jalan Mawar...                             │
├────────────────────────────────────────────────────┤
│  [ITEMS TABLE — alternating #2a2420 / #3a3430]     │
│  Fabric Type  │ Qty (m) │ Unit Price │ Subtotal    │
│  Dubai Cotton │ 250     │ RM 38.00   │ RM 9,500.00 │
├────────────────────────────────────────────────────┤
│  [TOTALS BLOCK — #3a3430 bg, accent text #cfab6d]  │
│  Subtotal:              RM 9,500.00                 │
│  Discount (10%):       - RM 950.00                 │
│  ─────────────────────────────────                 │
│  TOTAL:                 RM 8,550.00                 │
├────────────────────────────────────────────────────┤
│  [FOOTER — #2a2420 bg, secondary text #d4cfc9]     │
│  Thank you for your business.                      │
│  Generated via Antara Batik BMS                    │
└────────────────────────────────────────────────────┘
```

### 8.3 PDF Technical Requirements

| Property | Spec |
|---|---|
| Engine | Puppeteer (HTML→PDF) — recommended for pixel-perfect output |
| Page Size | A4 |
| Orientation | Portrait |
| Font | To be defined (recommend: Playfair Display or EB Garamond for elegance) |
| Font Format | Embedded in PDF (no system font dependency) |
| File Naming | `Invoice_INV-000124.pdf` / `Receipt_REC-000085.pdf` |
| Storage Path | `/documents/{year}/{month}/{filename}` |

---

## 9. Database Schema

### 9.1 `documents` Table

```sql
CREATE TABLE documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_id    TEXT NOT NULL UNIQUE,       -- INV-000124 / REC-000085
  document_type   TEXT NOT NULL,              -- 'invoice' | 'receipt'
  source          TEXT NOT NULL DEFAULT 'desktop', -- 'telegram' | 'desktop'
  telegram_chat_id TEXT,                      -- nullable; set if source = telegram

  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  customer_email  TEXT,

  fabric_type     TEXT NOT NULL,              -- 'Dubai Cotton' | 'Cotton Viscose'
  quantity_meters REAL NOT NULL,
  unit_price      REAL NOT NULL,
  subtotal        REAL NOT NULL,

  discount_type   TEXT,                       -- 'percentage' | 'fixed' | null
  discount_value  REAL,
  discount_amount REAL,
  total           REAL NOT NULL,

  pdf_path        TEXT,                       -- local file path
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 9.2 `reference_sequences` Table

```sql
CREATE TABLE reference_sequences (
  series          TEXT PRIMARY KEY,           -- 'INV' | 'REC'
  last_number     INTEGER NOT NULL DEFAULT 0
);

-- Seed data
INSERT INTO reference_sequences VALUES ('INV', 0);
INSERT INTO reference_sequences VALUES ('REC', 0);
```

### 9.3 `bot_sessions` Table

```sql
CREATE TABLE bot_sessions (
  chat_id         TEXT PRIMARY KEY,
  session_data    TEXT,                       -- JSON blob of current flow state
  current_step    TEXT,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Session State Management

### 10.1 Session Object Structure (per Telegram `chat_id`)

```json
{
  "chat_id": "123456789",
  "step": "awaiting_quantity",
  "data": {
    "customer_name": "Ahmad Razif",
    "customer_phone": "0123456789",
    "billing_address": "No 12, Jalan Mawar, 75000 Melaka",
    "delivery_address": "No 12, Jalan Mawar, 75000 Melaka",
    "customer_email": null,
    "document_type": "invoice",
    "fabric_type": "Dubai Cotton",
    "quantity_meters": null,
    "unit_price": null,
    "subtotal": null,
    "discount_type": null,
    "discount_value": null,
    "total": null
  },
  "started_at": "2025-07-15T10:00:00Z",
  "updated_at": "2025-07-15T10:05:00Z"
}
```

### 10.2 Step Definitions

| Step Key | Description |
|---|---|
| `awaiting_name` | Waiting for customer name |
| `awaiting_phone` | Waiting for phone number |
| `awaiting_billing` | Waiting for billing address |
| `awaiting_delivery` | Waiting for delivery address |
| `awaiting_email` | Waiting for email (or skip) |
| `awaiting_doc_type` | Waiting for document type selection |
| `awaiting_fabric` | Waiting for fabric type selection |
| `awaiting_quantity` | Waiting for quantity in meters |
| `awaiting_adjustment_type` | Waiting for discount type selection |
| `awaiting_adjustment_value` | Waiting for discount value |
| `awaiting_confirmation` | Waiting for confirm or edit |
| `processing` | Payload sent to desktop app, awaiting PDF |
| `complete` | PDF delivered to user |

### 10.3 Session Rules

- Sessions expire after **30 minutes** of inactivity → bot prompts user to restart
- Each `chat_id` maintains exactly one active session at a time
- `/cancel` command clears the session at any step
- `/start` or `/new` always resets the session

---

## 11. Error Handling & Validation

### 11.1 Input Validation Rules

| Field | Rule |
|---|---|
| Customer Name | Non-empty, min 2 characters |
| Phone | Numeric, 10–12 digits, allow leading `+60` |
| Billing / Delivery Address | Non-empty, min 10 characters |
| Email | Valid email format OR "skip" |
| Quantity | Positive number > 0, max 99,999 meters |
| Discount (%) | 0.01 to 99.99 |
| Discount (RM) | > 0, must be less than subtotal |

### 11.2 Bot Validation Messages

```
❌ Invalid quantity. Please enter a number greater than 0.

❌ Discount cannot exceed the total amount. Please enter a lower value.

❌ Invalid phone number. Please enter a valid Malaysian number (e.g. 0123456789).

❌ Please use the buttons provided to select an option.
```

### 11.3 Desktop App Timeout

- Bot waits max **30 seconds** for desktop app response
- If no response: bot sends `"⚠️ Generation timed out. Please try again."`
- Session is NOT cleared on timeout — user can retry with `/retry`

---

## 12. Security Considerations

| Concern | Mitigation |
|---|---|
| API access control | `X-Antara-Key` header on all internal API calls |
| Bot access control | Optional: whitelist specific Telegram `chat_id`s |
| PDF storage | Local filesystem only; never publicly accessible |
| Input injection | All inputs sanitized before PDF rendering |
| API key rotation | Stored in `.env` — never hardcoded |
| Session isolation | Sessions are strictly per `chat_id` — no cross-user leakage |

---

## 13. Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)

- [ ] Set up Telegram Bot via BotFather, obtain token
- [ ] Scaffold bot service (Node.js + Telegraf)
- [ ] Implement session state engine (in-memory)
- [ ] Implement all 10 conversation steps with validation
- [ ] Unit test each step handler

### Phase 2 — Desktop API Layer (Week 2–3)

- [ ] Expose internal REST API on desktop app (port 3001)
- [ ] Implement `POST /api/documents/generate` endpoint
- [ ] Implement reference ID generator (INV/REC sequences)
- [ ] Implement pricing engine (tier-based calculation)
- [ ] Implement discount logic (% and fixed)
- [ ] Set up `documents` and `reference_sequences` DB tables

### Phase 3 — PDF Engine (Week 3–4)

- [ ] Design invoice HTML template using Antara Batik PDF palette
- [ ] Design receipt HTML template
- [ ] Integrate Puppeteer for HTML → PDF conversion
- [ ] Embed custom font into PDF
- [ ] Test PDF output across all scenarios (all tiers + discounts)
- [ ] Store generated PDFs in `/documents/{year}/{month}/`

### Phase 4 — Integration & E2E Testing (Week 4–5)

- [ ] Connect bot → desktop API → PDF → bot delivery
- [ ] Test full end-to-end flow for Invoice
- [ ] Test full end-to-end flow for Receipt
- [ ] Test all discount combinations
- [ ] Test session timeout and recovery
- [ ] Test concurrent users (multiple chat sessions simultaneously)
- [ ] Test invalid inputs at each step

### Phase 5 — Polish & Deployment (Week 5–6)

- [ ] Refine bot UX copy and formatting
- [ ] Add `/help` and `/cancel` commands
- [ ] Add `/status` command (check last generated document)
- [ ] Error logging and alerting
- [ ] Load testing
- [ ] Documentation finalization
- [ ] Staging deployment and UAT with Antara Batik team

---

## 14. Team Task Allocation

> Team of 10. Roles and sprint assignments below.

| # | Role | Responsibility |
|---|---|---|
| 1 | **Bot Lead** | Telegram bot flow, session management, all step handlers |
| 2 | **Bot Support** | Input validation, error messages, UX copy, /help /cancel commands |
| 3 | **API Engineer** | Desktop REST API — document generation endpoint, health check |
| 4 | **Pricing & Logic** | Pricing engine, discount logic, reference ID generator |
| 5 | **PDF Engineer** | Puppeteer integration, HTML invoice/receipt template, font embedding |
| 6 | **PDF Designer** | Visual design of invoice and receipt PDF (HTML/CSS, brand colors) |
| 7 | **Database Engineer** | Schema design, migrations, sequence management, query optimization |
| 8 | **QA Lead** | Test plan, E2E test cases, edge case coverage, regression suite |
| 9 | **DevOps / Infra** | Bot deployment, process management (PM2), API key management, `.env` setup |
| 10 | **Tech Lead / Architect** | Code review, integration oversight, architecture decisions, documentation |

---

## 15. Future Scalability

This architecture is intentionally modular to support future channels without changes to the core engine.

| Future Channel | What Changes | What Stays Same |
|---|---|---|
| WhatsApp Bot | New input service (WhatsApp API) | Desktop engine, PDF, DB, pricing logic |
| Web App | React/Vue frontend | Desktop engine, PDF, DB, pricing logic |
| Mobile App | Native or React Native | Desktop engine, PDF, DB, pricing logic |
| Email Delivery | Add email sender on desktop API | Bot flow unchanged |
| Multi-item Orders | Add loop in bot flow + DB row per item | Pricing engine logic unchanged |
| Multi-language | Add `lang` to session state | All other logic unchanged |

> The API contract defined in Section 6 is the stable interface — all channels speak the same language.

---

## Appendix A — Environment Variables

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Desktop App API
DESKTOP_API_URL=http://localhost:3001
DESKTOP_API_KEY=your_secret_api_key_here

# Session Config
SESSION_TIMEOUT_MINUTES=30

# PDF Storage
PDF_STORAGE_PATH=./documents

# Database
DB_PATH=./antara_batik.db
```

---

## Appendix B — Tech Stack Summary

| Layer | Technology |
|---|---|
| Bot Runtime | Node.js v20+ |
| Bot Framework | Telegraf v4 |
| Desktop App | Electron + Node.js (existing) |
| Internal API | Express.js (REST) |
| PDF Engine | Puppeteer |
| Database | SQLite (development) / PostgreSQL (production) |
| Process Manager | PM2 |
| Session Cache | In-memory / Redis (production) |
| Version Control | Git (feature branch per module) |

---

*Document version 2.0 — Antara Batik Business Management System — Telegram Integration*
*Classification: Internal — Engineering Team*