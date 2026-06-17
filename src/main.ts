import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { registerIpcHandlers } from './main/ipcHandlers';
import { JobScheduler } from './services/jobScheduler';
import { Database } from './db/database';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { SupabaseSyncService } from './services/supabase-sync.service';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Force dark mode at OS level
nativeTheme.themeSource = 'dark';

const createWindow = () => {
  const isMac = process.platform === 'darwin';
  const mainWindow = new BrowserWindow({
    width: 1620,
    height: 1020,
    minWidth: 1100,
    minHeight: 700,
    transparent: isMac, // Enable transparency on macOS for vibrant liquid glass
    vibrancy: isMac ? 'under-window' : undefined, // Enable native macOS Liquid Glass vibrancy
    visualEffectState: 'active',
    backgroundColor: isMac ? '#00000000' : '#14151a', // Transparent background to show vibrancy
    titleBarStyle: isMac ? 'hidden' : 'default', // Clear macOS default titlebar for custom title area
    frame: !isMac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// IPC: EPF calculation
ipcMain.handle('payroll:calculate-epf', async (_, { salary, employeeType, prMonths }) => {
  const rates = {
    malaysian: { employee: 0.11, employer: salary <= 5000 ? 0.13 : 0.12 },
    pr: { employee: prMonths <= 60 ? 0.055 : 0.11, employer: salary <= 5000 ? 0.13 : 0.12 },
    foreigner: { employee: 0.05, employer: 0.05 },
  };
  const r = rates[employeeType as keyof typeof rates] || rates.malaysian;
  return {
    employeeContribution: Math.ceil(salary * r.employee),
    employerContribution: Math.ceil(salary * r.employer),
    totalContribution: Math.ceil(salary * r.employee) + Math.ceil(salary * r.employer),
  };
});

// IPC: SOCSO calculation (simplified)
ipcMain.handle('payroll:calculate-socso', async (_, { salary, age }) => {
  const capped = Math.min(salary, 5000);
  if (age >= 60) {
    return { employeeContribution: 0, employerContribution: capped * 0.009, scheme: 'EIS-I only' };
  }
  return {
    employeeContribution: Math.round(capped * 0.005 * 100) / 100,
    employerContribution: Math.round(capped * 0.0175 * 100) / 100,
    scheme: 'First & Second Category',
  };
});

// IPC: EIS calculation
ipcMain.handle('payroll:calculate-eis', async (_, { salary, age }) => {
  if (age >= 57) return { employeeContribution: 0, employerContribution: 0, exempt: true };
  const capped = Math.min(salary, 4000);
  const contrib = Math.round(capped * 0.002 * 100) / 100;
  return { employeeContribution: contrib, employerContribution: contrib, exempt: false };
});

// IPC: PCB calculation (simplified)
ipcMain.handle('payroll:calculate-pcb', async (_, { grossMonthly, epfEmployee, residentStatus }) => {
  const annual = grossMonthly * 12;
  const deduction = Math.min(annual * 0.20, 4000);
  const epfRelief = Math.min((epfEmployee || 0) * 12, 4000);
  const chargeable = Math.max(0, annual - deduction - epfRelief - 9000);

  let tax = 0;
  if (residentStatus === 'resident') {
    if (chargeable > 2000000) tax = 517450 + (chargeable - 2000001) * 0.30;
    else if (chargeable > 1000000) tax = 237450 + (chargeable - 1000001) * 0.28;
    else if (chargeable > 600000) tax = 133450 + (chargeable - 600001) * 0.26;
    else if (chargeable > 400000) tax = 83450 + (chargeable - 400001) * 0.25;
    else if (chargeable > 250000) tax = 46700 + (chargeable - 250001) * 0.245;
    else if (chargeable > 100000) tax = 10700 + (chargeable - 100001) * 0.24;
    else if (chargeable > 70000) tax = 4400 + (chargeable - 70001) * 0.21;
    else if (chargeable > 50000) tax = 1800 + (chargeable - 50001) * 0.13;
    else if (chargeable > 35000) tax = 600 + (chargeable - 35001) * 0.08;
    else if (chargeable > 20000) tax = 150 + (chargeable - 20001) * 0.03;
    else if (chargeable > 5000) tax = (chargeable - 5001) * 0.01;
  } else {
    tax = chargeable * 0.30;
  }

  return {
    monthlyPcb: Math.ceil(Math.max(0, tax) / 12),
    annualTax: Math.round(tax),
    chargeableIncome: chargeable,
  };
});

// IPC: Resize main window with macOS elastic transitions
ipcMain.handle('window:resize', async (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setMinimumSize(Math.min(width, 900), Math.min(height, 600));
    win.setSize(width, height, true); // true enables beautiful native animations on macOS
  }
});

// IPC: BNM exchange rates (mock for offline)
ipcMain.handle('bnm:get-exchange-rates', async () => {
  return [
    { currency: 'USD', rate: 4.71, buy: 4.70, sell: 4.72 },
    { currency: 'EUR', rate: 5.12, buy: 5.10, sell: 5.14 },
    { currency: 'GBP', rate: 5.97, buy: 5.95, sell: 5.99 },
    { currency: 'SGD', rate: 3.52, buy: 3.51, sell: 3.53 },
    { currency: 'JPY', rate: 0.032, buy: 0.031, sell: 0.033 },
    { currency: 'CNY', rate: 0.65, buy: 0.64, sell: 0.66 },
    { currency: 'AUD', rate: 3.01, buy: 3.00, sell: 3.02 },
    { currency: 'HKD', rate: 0.60, buy: 0.59, sell: 0.61 },
  ];
});

let scheduler: JobScheduler | null = null;
let syncService: SupabaseSyncService | null = null;

app.on('ready', () => {
  // Register Module 1-4 high-fidelity backend IPC handlers
  registerIpcHandlers();

  // Instantiate and run continuous cron/schedule jobs
  scheduler = new JobScheduler();
  scheduler.start();

  // Initialize Supabase Sync Engine
  syncService = new SupabaseSyncService();
  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  syncService.init(supaUrl, supaKey);

  createWindow();
});

app.on('window-all-closed', () => {
  if (scheduler) {
    scheduler.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
