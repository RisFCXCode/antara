import { Database, Employee, PayrollRun, LeaveRecord } from '../db/database';

export interface StatutoryRates {
  epf: {
    employeeRate: number;
    employerRateBelow5k: number;
    employerRateAbove5k: number;
  };
  socso: {
    employeeRate: number;
    employerRate: number;
  };
  eis: {
    employeeRate: number;
    employerRate: number;
  };
}

// Configurable and versioned rates (Malaysian Statutory Config)
export const STATUTORY_CONFIG_2026: StatutoryRates = {
  epf: {
    employeeRate: 0.11,
    employerRateBelow5k: 0.13,
    employerRateAbove5k: 0.12
  },
  socso: {
    employeeRate: 0.005,
    employerRate: 0.0175
  },
  eis: {
    employeeRate: 0.002,
    employerRate: 0.002
  }
};

export class PayrollService {
  private db: Database;
  private rates: StatutoryRates;

  constructor(rates = STATUTORY_CONFIG_2026) {
    this.db = Database.getInstance();
    this.rates = rates;
  }

  // ==========================================
  // PURE FUNCTION STATUTORY CALCULATOR
  // ==========================================

  public calculateEpf(salary: number, isMalaysian = true): { employee: number; employer: number } {
    if (!isMalaysian) {
      // Foreigner flat rates (RM 5/5 or 5%/5% standard)
      return { employee: Math.ceil(salary * 0.05), employer: Math.ceil(salary * 0.05) };
    }
    const empContrib = Math.ceil(salary * this.rates.epf.employeeRate);
    const employerRate = salary <= 5000 ? this.rates.epf.employerRateBelow5k : this.rates.epf.employerRateAbove5k;
    const emprContrib = Math.ceil(salary * employerRate);
    return { employee: empContrib, employer: emprContrib };
  }

  public calculateSocso(salary: number): { employee: number; employer: number } {
    const cappedSalary = Math.min(salary, 5000); // Malaysian SOCSO cap at RM 5,000
    const employee = Math.round(cappedSalary * this.rates.socso.employeeRate * 100) / 100;
    const employer = Math.round(cappedSalary * this.rates.socso.employerRate * 100) / 100;
    return { employee, employer };
  }

  public calculateEis(salary: number): { employee: number; employer: number } {
    const cappedSalary = Math.min(salary, 4000); // Malaysian EIS cap at RM 4,000
    const employee = Math.round(cappedSalary * this.rates.eis.employeeRate * 100) / 100;
    const employer = Math.round(cappedSalary * this.rates.eis.employerRate * 100) / 100;
    return { employee, employer };
  }

  public calculatePcb(salary: number, epfEmployeeContribution: number): number {
    // Annualized calculation with personal reliefs
    const annualGross = salary * 12;
    const personalRelief = 9000;
    const epfRelief = Math.min(epfEmployeeContribution * 12, 4000);
    const chargeable = Math.max(0, annualGross - personalRelief - epfRelief);

    let annualTax = 0;
    if (chargeable > 2000000) annualTax = 517450 + (chargeable - 2000000) * 0.30;
    else if (chargeable > 1000000) annualTax = 237450 + (chargeable - 1000000) * 0.28;
    else if (chargeable > 600000) annualTax = 133450 + (chargeable - 600000) * 0.26;
    else if (chargeable > 400000) annualTax = 83450 + (chargeable - 400000) * 0.25;
    else if (chargeable > 250000) annualTax = 46700 + (chargeable - 250000) * 0.245;
    else if (chargeable > 100000) annualTax = 10700 + (chargeable - 100000) * 0.24;
    else if (chargeable > 70000) annualTax = 4400 + (chargeable - 70000) * 0.21;
    else if (chargeable > 50000) annualTax = 1800 + (chargeable - 50000) * 0.13;
    else if (chargeable > 35000) annualTax = 600 + (chargeable - 35000) * 0.08;
    else if (chargeable > 20000) annualTax = 150 + (chargeable - 20000) * 0.03;
    
    return Math.ceil(Math.max(0, annualTax) / 12);
  }

  // ==========================================
  // LEAVE & ATTENDANCE PAYROLL BRIDGE
  // ==========================================

  public processMonthlyPayroll(period: string): PayrollRun {
    const employees = this.db.getEmployees();
    const leaves = this.db.getLeaveRecords();
    
    const runEmployees: PayrollRun['employees'] = [];
    let grossTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;

    employees.forEach(emp => {
      // 1. Calculate base salary adjustments based on Unpaid Leave records
      const unpaidLeaves = leaves.filter(
        l => l.employee_id === emp.id && 
             l.type === 'unpaid' && 
             l.status === 'approved' &&
             l.start_date.startsWith(period)
      );
      
      const unpaidDaysCount = unpaidLeaves.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        return acc + diff;
      }, 0);

      // Deduct salary per unpaid leave (base / 26 standard working days Malaysian Employment Act)
      const dailyRate = emp.base_salary / 26;
      const deductionAmount = unpaidDaysCount * dailyRate;
      const grossSalary = Math.max(0, emp.base_salary - deductionAmount);

      // 2. Perform pure calculations
      const isMalaysian = !emp.ic_no.startsWith('F');
      const epf = this.calculateEpf(grossSalary, isMalaysian);
      const socso = this.calculateSocso(grossSalary);
      const eis = this.calculateEis(grossSalary);
      const pcb = this.calculatePcb(grossSalary, epf.employee);

      const totalDeductions = epf.employee + socso.employee + eis.employee + pcb;
      const netSalary = grossSalary - totalDeductions;

      runEmployees.push({
        employee_id: emp.id,
        gross: grossSalary,
        epf_employee: epf.employee,
        epf_employer: epf.employer,
        socso_employee: socso.employee,
        socso_employer: socso.employer,
        eis_employee: eis.employee,
        eis_employer: eis.employer,
        pcb,
        net: netSalary
      });

      grossTotal += grossSalary;
      deductionTotal += totalDeductions;
      netTotal += netSalary;
    });

    const payrollRun: PayrollRun = {
      id: `run-${period}-${Math.random().toString(36).substring(2, 7)}`,
      period,
      employees: runEmployees,
      gross: grossTotal,
      deductions: deductionTotal,
      net: netTotal,
      status: 'draft',
      generated_at: new Date().toISOString()
    };

    this.db.savePayrollRun(payrollRun);
    this.db.log('payroll', `Processed monthly payroll for period ${period}`, `Calculated ${runEmployees.length} employees.`);
    
    return payrollRun;
  }

  // ==========================================
  // STATUTORY PORTAL SUBMISSION GENERATORS
  // ==========================================

  public generateEpfBorangA(runId: string): string {
    const run = this.db.getPayrollRun(runId);
    if (!run) throw new Error('Payroll run not found.');

    // High fidelity EPF Borang A CSV format output
    let csv = 'EPF Borang A Submission File,Formatted for KWSP Portal\n';
    csv += 'Employee ID,Name,IC No,EPF Number,Gross Salary,Employee Contribution,Employer Contribution,Total\n';

    run.employees.forEach(item => {
      const emp = this.db.getEmployee(item.employee_id);
      if (emp) {
        const total = item.epf_employee + item.epf_employer;
        csv += `${emp.id},"${emp.name}",${emp.ic_no},${emp.epf_no},${item.gross.toFixed(2)},${item.epf_employee.toFixed(2)},${item.epf_employer.toFixed(2)},${total.toFixed(2)}\n`;
      }
    });

    this.db.log('payroll', `Exported EPF Borang A for run: ${runId}`, 'CSV generated successfully');
    return csv;
  }

  public generateSocsoBorang8A(runId: string): string {
    const run = this.db.getPayrollRun(runId);
    if (!run) throw new Error('Payroll run not found.');

    let csv = 'SOCSO Borang 8A Submission File,Formatted for PERKESO Portal\n';
    csv += 'Employee ID,Name,IC No,SOCSO Number,Gross Salary,Employee Contribution,Employer Contribution\n';

    run.employees.forEach(item => {
      const emp = this.db.getEmployee(item.employee_id);
      if (emp) {
        csv += `${emp.id},"${emp.name}",${emp.ic_no},${emp.socso_no},${item.gross.toFixed(2)},${item.socso_employee.toFixed(2)},${item.socso_employer.toFixed(2)}\n`;
      }
    });

    this.db.log('payroll', `Exported SOCSO Borang 8A for run: ${runId}`, 'CSV generated successfully');
    return csv;
  }

  // ==========================================
  // BANK GIRO / DUITNOW BULK FILE GENERATOR
  // ==========================================

  public generateMaybankGiroFile(runId: string): string {
    const run = this.db.getPayrollRun(runId);
    if (!run) throw new Error('Payroll run not found.');

    // High-fidelity standard bank bulk payment format:
    // Header record followed by detailed transactional lines
    let bankFile = `MBB-PAYROLL-HEADER|${run.period}|RECO-MYR|${run.net.toFixed(2)}\n`;
    
    run.employees.forEach(item => {
      const emp = this.db.getEmployee(item.employee_id);
      if (emp) {
        bankFile += `TXN|${emp.bank_acc}|${emp.name.substring(0, 20).padEnd(20, ' ')}|${item.net.toFixed(2)}|DuitNow|SalaryPmt\n`;
      }
    });

    this.db.log('payroll', `Exported Maybank GIRO Transfer file for run: ${runId}`, 'Bank payload generated');
    return bankFile;
  }
}
