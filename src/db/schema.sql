-- ==========================================
-- SCHEMA DEFINITIONS FOR MYAUTOMATE V1
-- ==========================================

-- MODULE 1: E-INVOICING (LHDN MYINVOIS)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    supplier_tin TEXT NOT NULL,
    buyer_tin TEXT NOT NULL,
    items JSON NOT NULL,
    total REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT CHECK(status IN ('draft', 'pending', 'submitted', 'validated', 'rejected')) DEFAULT 'draft',
    lhdn_uuid TEXT,
    submitted_at TEXT,
    validated_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_hash TEXT,
    result TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- MODULE 2: HR & PAYROLL
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ic_no TEXT NOT NULL UNIQUE,
    epf_no TEXT NOT NULL,
    socso_no TEXT NOT NULL,
    bank_acc TEXT NOT NULL,
    department TEXT NOT NULL,
    salary_type TEXT CHECK(salary_type IN ('monthly', 'hourly')) DEFAULT 'monthly',
    base_salary REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL, -- Format: YYYY-MM
    employees JSON NOT NULL,
    gross REAL NOT NULL,
    deductions REAL NOT NULL,
    net REAL NOT NULL,
    status TEXT CHECK(status IN ('draft', 'processed', 'approved', 'disbursed')) DEFAULT 'draft',
    generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('annual', 'medical', 'unpaid', 'maternity', 'paternity')) DEFAULT 'annual',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

-- MODULE 3: EXPENSE MANAGEMENT
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    vendor TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    myr_amount REAL NOT NULL,
    fx_rate REAL NOT NULL,
    category TEXT NOT NULL,
    receipt_url TEXT,
    policy_status TEXT CHECK(policy_status IN ('passed', 'flagged')) DEFAULT 'passed',
    policy_reasons JSON,
    approval_status TEXT CHECK(approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reimbursed_at TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS approval_rules (
    id TEXT PRIMARY KEY,
    condition_json TEXT NOT NULL,
    approver_role TEXT NOT NULL,
    escalation_hours INTEGER NOT NULL DEFAULT 24
);

-- MODULE 4: EMAIL AUTOMATION & TRACKING
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
    sender TEXT NOT NULL,
    recipients JSON NOT NULL,
    subject TEXT NOT NULL,
    body_hash TEXT NOT NULL,
    category TEXT CHECK(category IN ('Invoice', 'Support Request', 'HR Inquiry', 'Approval Request', 'Spam', 'General')) DEFAULT 'General',
    priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'low',
    sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative', 'urgent')) DEFAULT 'neutral',
    thread_id TEXT NOT NULL,
    delivery_status TEXT CHECK(delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')) DEFAULT 'pending',
    opened_at TEXT,
    tracking_pixel_id TEXT,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    fields JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_up_sequences (
    id TEXT PRIMARY KEY,
    parent_message_id TEXT NOT NULL,
    steps JSON NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
    FOREIGN KEY(parent_message_id) REFERENCES emails(id)
);

CREATE TABLE IF NOT EXISTS sender_frequencies (
    sender_email TEXT NOT NULL,
    window_type TEXT CHECK(window_type IN ('day', 'week', 'month')) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    last_seen TEXT NOT NULL,
    PRIMARY KEY(sender_email, window_type)
);

CREATE TABLE IF NOT EXISTS email_analytics (
    period TEXT PRIMARY KEY, -- Format: YYYY-MM
    open_rate REAL NOT NULL,
    click_rate REAL NOT NULL,
    avg_response_time_hrs REAL NOT NULL,
    top_senders JSON NOT NULL
);
