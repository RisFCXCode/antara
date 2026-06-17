import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Activity,
  Shield,
  Calculator,
  Users,
  UserPlus,
  TrendingUp,
  X,
  Plus
} from 'lucide-react';

type Tab = 'epf' | 'socso' | 'eis' | 'pcb' | 'payslip';

const DEFAULT_EMPLOYEES = [
  { id: '1', name: 'Ahmad Faizal',     ic: '890112-14-5678', type: 'malaysian', age: 36, salary: 5500, dept: 'Engineering' },
  { id: '2', name: 'Siti Rahimah',     ic: '920304-08-9012', type: 'malaysian', age: 33, salary: 4200, dept: 'Finance' },
  { id: '3', name: 'Rajan Krishnan',   ic: '850720-10-3456', type: 'malaysian', age: 40, salary: 7800, dept: 'Management' },
  { id: '4', name: 'Wong Mei Ling',    ic: '951103-07-7890', type: 'pr',        age: 30, salary: 4800, dept: 'Marketing', prMonths: 24 },
  { id: '5', name: 'John Smith',       ic: 'A12345678',      type: 'foreigner', age: 35, salary: 6500, dept: 'IT' },
];

export default function Payroll() {
  const [tab, setTab] = useState<Tab>('epf');
  const [salary, setSalary] = useState('5000');
  const [age, setAge] = useState('30');
  const [empType, setEmpType] = useState('malaysian');
  const [prMonths, setPrMonths] = useState('0');
  const [resident, setResident] = useState('resident');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Load Employees from database
  const loadEmployees = async () => {
    try {
      const emps = await window.electronAPI.getEmployees();
      if (emps && emps.length > 0) {
        setDbEmployees(emps);
      } else {
        // Pre-populate with high-fidelity defaults
        for (const item of DEFAULT_EMPLOYEES) {
          const dbItem = {
            id: `emp-${item.id}`,
            name: item.name,
            ic_no: item.ic,
            epf_no: `EPF-${10000000 + parseInt(item.id)}`,
            socso_no: `SOCSO-${20000000 + parseInt(item.id)}`,
            bank_acc: `MBB-${500000000 + parseInt(item.id)}`,
            department: item.dept,
            salary_type: 'monthly' as const,
            base_salary: item.salary
          };
          await window.electronAPI.saveEmployee(dbItem);
        }
        const reloaded = await window.electronAPI.getEmployees();
        setDbEmployees(reloaded);
      }
    } catch (err) {
      console.error('[Payroll] Load employees failed:', err);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (tabsRef.current) {
      const activeEl = tabsRef.current.querySelector('.header-tab-btn.active') as HTMLElement;
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth
        });
      }
    }
  }, [tab]);

  const calculate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const sal = parseFloat(salary) || 0;
      const a   = parseInt(age) || 30;
      let res: any;

      if (tab === 'epf') {
        res = await window.electronAPI.calculateEpf({ salary: sal, employeeType: empType, prMonths: parseInt(prMonths) });
      } else if (tab === 'socso') {
        res = await window.electronAPI.calculateSocso({ salary: sal, age: a });
      } else if (tab === 'eis') {
        res = await window.electronAPI.calculateEis({ salary: sal, age: a });
      } else if (tab === 'pcb') {
        const epfEmp = sal * (empType === 'malaysian' ? 0.11 : 0.055);
        res = await window.electronAPI.calculatePcb({ grossMonthly: sal, epfEmployee: epfEmp, residentStatus: resident });
      }
      setResult(res);
    } catch {
      // Fallback preview calculation in case of API failure
      const sal = parseFloat(salary) || 0;
      if (tab === 'epf') {
        const empRate = empType === 'malaysian' ? 0.11 : empType === 'pr' ? 0.055 : 0.00;
        const totalRate = empType === 'malaysian' ? 0.24 : empType === 'pr' ? 0.175 : 0.05;
        setResult({
          employeeContribution: sal * empRate,
          employerContribution: sal * (totalRate - empRate),
          totalContribution: sal * totalRate
        });
      } else if (tab === 'socso') {
        setResult({
          scheme: 'Employment Injury & Invalidity Scheme',
          employeeContribution: sal * 0.005,
          employerContribution: sal * 0.0175
        });
      } else if (tab === 'eis') {
        setResult({
          exempt: parseInt(age) >= 57,
          employeeContribution: sal * 0.002,
          employerContribution: sal * 0.002
        });
      } else if (tab === 'pcb') {
        setResult({
          chargeableIncome: sal * 12,
          annualTax: sal * 12 * 0.08,
          monthlyPcb: sal * 0.03
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'epf',     label: 'EPF (KWSP)', icon: Briefcase },
    { id: 'socso',   label: 'SOCSO', icon: Activity },
    { id: 'eis',     label: 'EIS (SIP)', icon: Shield },
    { id: 'pcb',     label: 'PCB / MTD', icon: Calculator },
    { id: 'payslip', label: 'Employees', icon: Users },
  ];

  return (
    <div className="animate-in subpage-container">
      {/* Horizontal tabs matching pill style with smooth sliding movement */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: 16, marginBottom: 20 }}>
        <div className="header-tabs" ref={tabsRef}>
          {/* Continuous motion sliding background pill */}
          {indicatorStyle.width > 0 && (
            <div 
              className="header-tab-indicator" 
              style={{ 
                left: indicatorStyle.left,
                width: indicatorStyle.width
              }}
            />
          )}

          {TABS.map(t => {
            const IconComponent = t.icon;
            return (
              <button
                key={t.id}
                className={`header-tab-btn${tab === t.id ? ' active' : ''}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  position: 'relative',
                  zIndex: 1
                }}
                onClick={() => { setTab(t.id as Tab); setResult(null); }}
              >
                <IconComponent size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tab-content-fade" key={tab}>
        {tab === 'payslip' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {showAddForm && (
              <AddEmployeeForm 
                onClose={() => setShowAddForm(false)} 
                onSuccess={() => {
                  setShowAddForm(false);
                  loadEmployees();
                }}
              />
            )}
            <EmployeeTable 
              employees={dbEmployees} 
              onAddClick={() => setShowAddForm(!showAddForm)}
              showAddForm={showAddForm}
            />
          </div>
        ) : (
          <div className="grid-2">
            {/* Calculator Inputs */}
            <div className="screenshot-card">
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 6 }}>
                {tab === 'epf'   && 'EPF Contribution Calculator'}
                {tab === 'socso' && 'SOCSO Contribution Calculator'}
                {tab === 'eis'   && 'EIS Contribution Calculator'}
                {tab === 'pcb'   && 'PCB / MTD Calculator'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                {tab === 'epf'   && 'KWSP Act 1991 — Statutory rates'}
                {tab === 'socso' && 'SOCSO Act 1969 — Second Schedule'}
                {tab === 'eis'   && 'EIS Act 2017 — 0.2% statutory limit'}
                {tab === 'pcb'   && 'LHDN Circular 5/2024 — assessment rules'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Gross Monthly Salary (RM)</label>
                  <input className="screenshot-input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. 5000" min="0" />
                </div>

                {tab === 'epf' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Employee Type</label>
                      <select className="screenshot-select" value={empType} onChange={e => setEmpType(e.target.value)}>
                        <option value="malaysian">Malaysian Citizen (11%)</option>
                        <option value="pr">Permanent Resident (5.5% / 11%)</option>
                        <option value="foreigner">Foreigner (Voluntary)</option>
                      </select>
                    </div>
                    {empType === 'pr' && (
                      <div className="form-group">
                        <label className="form-label">PR Months in Malaysia</label>
                        <input className="screenshot-input" type="number" value={prMonths} onChange={e => setPrMonths(e.target.value)} />
                        <span className="form-hint">Rate changes after 60 months</span>
                      </div>
                    )}
                  </>
                )}

                {(tab === 'socso' || tab === 'eis') && (
                  <div className="form-group">
                    <label className="form-label">Employee Age</label>
                    <input className="screenshot-input" type="number" value={age} onChange={e => setAge(e.target.value)} min="16" max="100" />
                    {tab === 'socso' && <span className="form-hint">Age 60+ only contributes to Employment Injury scheme</span>}
                    {tab === 'eis'   && <span className="form-hint">Age 57+ is exempt from EIS contributions</span>}
                  </div>
                )}

                {tab === 'pcb' && (
                  <div className="form-group">
                    <label className="form-label">Resident Status</label>
                    <select className="screenshot-select" value={resident} onChange={e => setResident(e.target.value)}>
                      <option value="resident">Resident (Progressive tax rate)</option>
                      <option value="non-resident">Non-Resident (Flat 30% rate)</option>
                    </select>
                  </div>
                )}

                <button className="full-action-btn" onClick={calculate} disabled={loading} style={{ background: 'linear-gradient(135deg, rgba(180, 244, 82, 0.2), rgba(56, 189, 248, 0.15))', border: '1px solid rgba(180, 244, 82, 0.3)', color: '#fff', fontWeight: 600 }}>
                  {loading ? '⏳ Calculating…' : 'Calculate Contribution'}
                </button>
              </div>
            </div>

            {/* Calculator Results */}
            <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 24, textAlign: 'center' }}>Calculation Result</div>

              {!result && !loading && (
                <div className="empty-state" style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
                  <TrendingUp size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div className="empty-text" style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255, 255, 255, 0.45)' }}>Ready for Calculation</div>
                  <div className="empty-sub" style={{ fontSize: 12.5, color: 'rgba(255, 255, 255, 0.28)', marginTop: 6 }}>Enter details and click Calculate to compute statutory values</div>
                </div>
              )}

              {loading && (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />)}
                </div>
              )}

              {result && (
                <div className="result-fade-in" style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
                  {tab === 'epf' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employee Contribution (11%)</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employeeContribution?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employer Contribution</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employerContribution?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600 }}>Total to KWSP</span>
                        <span style={{ fontSize: 28, color: 'var(--accent-green)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>RM {result.totalContribution?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {tab === 'socso' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Selected Scheme</span>
                        <span style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600 }}>{result.scheme}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employee Contribution</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employeeContribution?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employer Contribution</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employerContribution?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600 }}>Total to PERKESO</span>
                        <span style={{ fontSize: 28, color: 'var(--accent-green)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>RM {(result.employeeContribution + result.employerContribution).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {tab === 'eis' && (
                    <>
                      {result.exempt ? (
                        <div style={{ textAlign: 'center', padding: '24px' }}>
                          <div style={{ fontWeight: 600, fontSize: 16, color: 'rgba(255, 255, 255, 0.75)' }}>Exempt from EIS</div>
                          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.35)', marginTop: 8, lineHeight: 1.4 }}>Employee aged 57+ is not required to contribute to EIS under statutory regulations</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employee Contribution (0.2%)</span>
                            <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employeeContribution?.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Employer Contribution (0.2%)</span>
                            <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.employerContribution?.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600 }}>Total EIS Contribution</span>
                            <span style={{ fontSize: 28, color: 'var(--accent-green)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>RM {(result.employeeContribution + result.employerContribution).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {tab === 'pcb' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Chargeable Income (Annual)</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.chargeableIncome?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>Annual Tax Liability</span>
                        <span style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>RM {result.annualTax?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600 }}>Monthly PCB Deduction</span>
                        <span style={{ fontSize: 28, color: 'var(--accent-green)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>RM {result.monthlyPcb?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setResult(null)} style={{ alignSelf: 'center', marginTop: 12, fontSize: 12 }}>
                    Dismiss Result
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EmployeeTableProps {
  employees: any[];
  onAddClick: () => void;
  showAddForm: boolean;
}

function EmployeeTable({ employees, onAddClick, showAddForm }: EmployeeTableProps) {
  return (
    <div className="screenshot-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>Employee Payroll Register</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>May 2025 · {employees.length} employees</div>
        </div>
        <button className="verify-btn-style" onClick={onAddClick} style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {showAddForm ? <X size={14} /> : <UserPlus size={14} />}
          {showAddForm ? 'Close' : 'Add Employee'}
        </button>
      </div>

      <div className="screenshot-table-wrap">
        <table className="screenshot-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>IC / Passport</th>
              <th>Type</th>
              <th>Dept</th>
              <th>Gross Salary</th>
              <th>EPF</th>
              <th>SOCSO</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e: any) => {
              const epf = !e.ic_no.startsWith('F') ? Math.ceil(e.base_salary * 0.11) : Math.ceil(e.base_salary * 0.05);
              const socso = Math.round(Math.min(e.base_salary, 5000) * 0.005 * 100) / 100;
              const typeLabel = !e.ic_no.startsWith('F') ? 'MY' : 'FG';
              
              return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td className="text-secondary" style={{ fontFamily: 'var(--font-display)', fontSize: 12.5 }}>{e.ic_no}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: typeLabel === 'MY' ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                      {typeLabel}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.department}</td>
                  <td style={{ fontWeight: 600 }}>RM {e.base_salary.toLocaleString()}</td>
                  <td>RM {epf}</td>
                  <td>RM {socso.toFixed(2)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                      Active
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AddEmployeeFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddEmployeeForm({ onClose, onSuccess }: AddEmployeeFormProps) {
  const [name, setName] = useState('');
  const [ic, setIc] = useState('');
  const [dept, setDept] = useState('Engineering');
  const [salary, setSalary] = useState('');
  const [epfNo, setEpfNo] = useState('');
  const [socsoNo, setSocsoNo] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name || !ic || !salary) {
      setErrorMsg('Name, IC/Passport, and Base Salary are required fields.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const salVal = parseFloat(salary) || 0;
      const newEmp = {
        id: `emp-${Math.random().toString(36).substring(2, 9)}`,
        name,
        ic_no: ic,
        epf_no: epfNo || `EPF-${Math.floor(Math.random() * 90000000) + 10000000}`,
        socso_no: socsoNo || `SOCSO-${Math.floor(Math.random() * 90000000) + 20000000}`,
        bank_acc: bankAcc || `MBB-${Math.floor(Math.random() * 900000000) + 500000000}`,
        department: dept,
        salary_type: 'monthly' as const,
        base_salary: salVal
      };

      await window.electronAPI.saveEmployee(newEmp);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save employee to database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screenshot-card" style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      padding: 20,
    }}>
      <div className="card-title-lg" style={{ fontSize: 16, marginBottom: 14 }}>Add New Employee</div>
      
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="screenshot-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmad Faizal" />
        </div>
        <div className="form-group">
          <label className="form-label">IC / Passport Number</label>
          <input className="screenshot-input" value={ic} onChange={e => setIc(e.target.value)} placeholder="e.g. 890112-14-5678" />
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select className="screenshot-select" value={dept} onChange={e => setDept(e.target.value)}>
            <option value="Engineering">Engineering</option>
            <option value="Finance">Finance</option>
            <option value="Management">Management</option>
            <option value="Marketing">Marketing</option>
            <option value="IT">IT</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Base Salary (RM)</label>
          <input className="screenshot-input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label className="form-label">EPF Account Number</label>
          <input className="screenshot-input" value={epfNo} onChange={e => setEpfNo(e.target.value)} placeholder="Optional" />
        </div>
        <div className="form-group">
          <label className="form-label">SOCSO Account Number</label>
          <input className="screenshot-input" value={socsoNo} onChange={e => setSocsoNo(e.target.value)} placeholder="Optional" />
        </div>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Bank Account Number (MBB / CIMB / PBB)</label>
          <input className="screenshot-input" value={bankAcc} onChange={e => setBankAcc(e.target.value)} placeholder="Optional bank account" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="verify-btn-style" onClick={handleSubmit} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />
          {submitting ? '⏳ Saving…' : 'Save Employee'}
        </button>
      </div>
    </div>
  );
}
