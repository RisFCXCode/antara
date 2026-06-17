import { Database, Expense, ApprovalRule } from '../db/database';

export class ExpenseService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  // ==========================================
  // POLICY VIOLATION FLAGGING ENGINE
  // ==========================================

  public evaluatePolicy(expense: Expense): { status: Expense['policy_status']; reasons: string[] } {
    const reasons: string[] = [];

    // Standard Malaysian SME business policy check rules:
    // 1. Food and entertainment limit
    if (expense.category === 'Meals & Entertainment' && expense.myr_amount > 150) {
      reasons.push('Meals & Entertainment expense exceeds standard RM 150 limit per claim.');
    }

    // 2. Travel limit
    if (expense.category === 'Travel & Lodging' && expense.myr_amount > 500) {
      reasons.push('Travel and lodging expense exceeds single claim maximum limit of RM 500.');
    }

    // 3. Receipt mandatory requirement
    if (expense.myr_amount > 50 && (!expense.receipt_url || expense.receipt_url.trim() === '')) {
      reasons.push('Receipt attachment is strictly mandatory for claims greater than RM 50.');
    }

    return {
      status: reasons.length > 0 ? 'flagged' : 'passed',
      reasons
    };
  }

  // ==========================================
  // MULTI-CURRENCY HANDLER
  // ==========================================

  public async processExpenseClaim(rawClaim: Omit<Expense, 'myr_amount' | 'policy_status' | 'approval_status'>): Promise<Expense> {
    // 1. Calculate base exchange conversions
    // In production, this would make an HTTPS call to: https://api.exchangerate-api.com/v4/latest/${rawClaim.currency}
    console.log(`[Expense] Processing currency exchange conversions for original currency: ${rawClaim.currency}...`);
    
    const myr_amount = rawClaim.amount * rawClaim.fx_rate;

    const newExpense: Expense = {
      ...rawClaim,
      myr_amount,
      policy_status: 'passed',
      approval_status: 'pending'
    };

    // 2. Evaluate company rules policies
    const evalRes = this.evaluatePolicy(newExpense);
    newExpense.policy_status = evalRes.status;
    newExpense.policy_reasons = evalRes.reasons;

    this.db.saveExpense(newExpense);
    this.db.log('expense', `Processed expense claim: ${newExpense.id}`, `Evaluation result: ${newExpense.policy_status}`);

    return newExpense;
  }

  // ==========================================
  // REIMBURSEMENT BATCH DISBURSEMENT GENERATOR
  // ==========================================

  public generateDisbursementFile(expenseIds: string[]): { success: boolean; fileContent: string; count: number } {
    let batchTotal = 0;
    let bankFile = `MBB-EXPENSE-REIMBURSEMENT-BATCH|${new Date().toISOString().split('T')[0]}\n`;
    let count = 0;

    expenseIds.forEach(id => {
      const exp = this.db.getExpense(id);
      if (exp && exp.approval_status === 'approved' && !exp.reimbursed_at) {
        const emp = this.db.getEmployee(exp.employee_id);
        if (emp) {
          bankFile += `REIMB|${emp.bank_acc}|${emp.name.substring(0, 20).padEnd(20, ' ')}|${exp.myr_amount.toFixed(2)}|DuitNow|ReimbursementClaim\n`;
          
          exp.reimbursed_at = new Date().toISOString();
          this.db.saveExpense(exp);
          
          batchTotal += exp.myr_amount;
          count++;
        }
      }
    });

    if (count === 0) {
      return { success: false, fileContent: '', count: 0 };
    }

    bankFile += `FOOTER|TOTAL_TXN=${count}|TOTAL_VAL=${batchTotal.toFixed(2)}\n`;
    this.db.log('expense', `Disbursed batch of ${count} expenses`, `Total RM ${batchTotal.toFixed(2)} transfer file exported.`);

    return {
      success: true,
      fileContent: bankFile,
      count
    };
  }
}
