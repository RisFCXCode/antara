import React, { useState, useEffect, useRef } from 'react';
import {
  Search
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import SalesTracking from './pages/SalesTracking';
import LeadIntelligence from './pages/LeadIntelligence';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

type Page =
  | 'dashboard'
  | 'invoices'
  | 'sales'
  | 'leads'
  | 'inventory'
  | 'settings';

interface NavItem {
  id: Page;
  label: string;
}

const TABS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'invoices',   label: 'Invoices & Receipts' },
  { id: 'sales',      label: 'Sales Tracking' },
  { id: 'leads',      label: 'Lead Intelligence' },
  { id: 'inventory',  label: 'Inventory & Projects' },
  { id: 'settings',   label: 'System Settings' }
];

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMac, setIsMac] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const [navIndicatorLeft, setNavIndicatorLeft] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const platform = window.navigator.platform || '';
      const ua = window.navigator.userAgent || '';
      if (platform.toUpperCase().indexOf('MAC') >= 0 || ua.indexOf('Mac') >= 0) {
        setIsMac(true);
      }
    }
  }, []);

  const navigateTo = (page: Page) => {
    if (page === activePage) return;
    setActivePage(page);
  };

  useEffect(() => {
    if (navRef.current) {
      const activeEl = navRef.current.querySelector('.header-tab-btn.active') as HTMLElement;
      if (activeEl) {
        // Center the 16px wide sliding highlight line perfectly under the button text
        const buttonCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
        setNavIndicatorLeft(buttonCenter - 8); // 8px is half of 16px
        setShowIndicator(true);
      }
    }
  }, [activePage]);

  const renderPageOf = (page: Page) => {
    switch (page) {
      case 'dashboard':  return <Dashboard navigateTo={navigateTo} />;
      case 'invoices':   return <Invoices />;
      case 'sales':      return <SalesTracking />;
      case 'leads':      return <LeadIntelligence />;
      case 'inventory':  return <Inventory />;
      case 'settings':   return <Settings />;
    }
  };

  return (
    <div className={`app-shell${isMac ? ' platform-mac' : ''}`}>
      {/* Native macOS Titlebar Drag Spacer */}
      {isMac && <div className="titlebar-spacer" />}

      {/* Volumetric Liquid Background Orbs */}
      <div className="ambient-glow-container">
        <div className="glow-orb orb-left" />
        <div className="glow-orb orb-right" />
        <div className="glow-orb orb-center" />
        <div className="glow-orb orb-bottom-left" />
        <div className="gradient-overlay" />
      </div>

      {/* Floating Header Capsule (Pill Bar) */}
      <header className="floating-header">
        <div className="search-circle">
          <Search size={16} />
        </div>

        <nav className="header-tabs" ref={navRef} style={{ position: 'relative' }}>
          {/* Dynamic sliding underline highlight for the main menu */}
          {showIndicator && (
            <div 
              className="header-tab-underline" 
              style={{ 
                left: navIndicatorLeft
              }}
            />
          )}

          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`header-tab-btn${activePage === tab.id ? ' active' : ''}`}
              onClick={() => navigateTo(tab.id)}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="header-profile">
          <div className="profile-img">AB</div>
          <span className="profile-name">Antara Batik Admin</span>
        </div>
      </header>

      {/* Main Full-Width Content Canvas */}
      <main className="main-viewport">
        <div className="animate-in" key={activePage}>
          {renderPageOf(activePage)}
        </div>
      </main>
    </div>
  );
}
