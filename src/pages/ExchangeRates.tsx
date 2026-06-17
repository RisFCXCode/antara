import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Globe,
  RefreshCw,
  Info,
  DollarSign
} from 'lucide-react';

const STATIC_RATES = [
  { currency: 'USD', name: 'US Dollar',        rate: 4.6850, prevRate: 4.6720 },
  { currency: 'SGD', name: 'Singapore Dollar', rate: 3.4720, prevRate: 3.4680 },
  { currency: 'EUR', name: 'Euro',             rate: 5.0920, prevRate: 5.1010 },
  { currency: 'GBP', name: 'British Pound',    rate: 5.9240, prevRate: 5.9180 },
  { currency: 'AUD', name: 'Australian Dollar',rate: 3.1240, prevRate: 3.1290 },
  { currency: 'JPY', name: 'Japanese Yen (100)',rate: 3.0120,prevRate: 3.0180 },
  { currency: 'CNY', name: 'Chinese Yuan',     rate: 0.6480, prevRate: 0.6475 },
];

export default function ExchangeRates() {
  const [rates, setRates] = useState<any[]>(STATIC_RATES);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('100');
  const [selectedCur, setSelectedCur] = useState('USD');
  const [convResult, setConvResult] = useState<string>('468.50');

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.fetchBnmRates();
      if (res && res.rates) {
        setRates(res.rates);
      }
    } catch {
      // preview fallback
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    const curObj = rates.find(r => r.currency === selectedCur);
    if (curObj) {
      const amt = parseFloat(amount) || 0;
      setConvResult((amt * curObj.rate).toFixed(2));
    }
  }, [amount, selectedCur, rates]);

  return (
    <div className="animate-in subpage-container">
      {/* Split grid */}
      <div className="grid-2">
        {/* Converter Calculator */}
        <div className="screenshot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 6 }}>BNM Currency Converter</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Official rate calculation (Base: MYR)</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Foreign Amount</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="screenshot-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1 }} />
                  <select className="screenshot-select" value={selectedCur} onChange={e => setSelectedCur(e.target.value)} style={{ width: 100 }}>
                    {rates.map(r => (
                      <option key={r.currency} value={r.currency}>{r.currency}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 12, padding: 18, marginTop: 24 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Calculated value</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>RM {convResult}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>MYR</span>
            </div>
          </div>
        </div>

        {/* Dynamic rate grids */}
        <div className="screenshot-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div className="card-title-lg" style={{ fontSize: 18, marginBottom: 4 }}>BNM Foreign Exchange rates</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Direct OpenAPI source · base 1 unit MYR</div>
            </div>
            <button className="search-circle" onClick={fetchRates} disabled={loading} style={{ width: 34, height: 34 }}>
              <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            </button>
          </div>

          <div className="screenshot-table-wrap">
            <table className="screenshot-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Name</th>
                  <th>Rate (MYR)</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rates.map(r => {
                  const up = r.rate >= r.prevRate;
                  return (
                    <tr key={r.currency}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{r.currency}</td>
                      <td className="text-secondary">{r.name}</td>
                      <td style={{ fontWeight: 700 }}>{r.rate.toFixed(4)}</td>
                      <td>
                        <span style={{ 
                          fontWeight: 700, 
                          fontSize: 16, 
                          color: up ? 'var(--accent-green)' : 'var(--accent-coral)',
                          display: 'inline-block',
                          lineHeight: 1
                        }}>
                          {up ? '↑' : '↓'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
