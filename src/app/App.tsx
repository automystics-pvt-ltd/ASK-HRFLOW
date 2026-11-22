import React, { useState, useEffect } from 'react';
import { CurrencyProvider } from './lib/currency';
import { AccessProvider, useAccess } from './lib/access';
import { BrandProvider } from './lib/branding';
import { LoginScreen } from './components/LoginScreen';
import { AccessRestricted } from './components/AccessRestricted';
import { AccessControl } from './components/AccessControl';
import { AuditLogs, NotificationsPage } from './components/AuditNotifications';
import { EmployeeDashboard, HRDashboard } from './components/RoleDashboards';
import { Toaster } from './components/ui/sonner';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardOverview } from './components/DashboardOverview';
import { EmployeeManagement } from './components/EmployeeManagement';
import { AttendanceLeave } from './components/AttendanceLeave';
import { AIAssistant } from './components/AIAssistant';
import {
  PayrollManagement,
  RecruitmentManagement,
  PerformanceManagement,
  EmployeeEngagement,
  SettingsPage,
} from './feature-pages';

const validTabs = ['dashboard', 'employees', 'attendance', 'payroll', 'recruitment', 'performance', 'engagement', 'ai-assistant', 'notifications', 'access', 'audit', 'settings'];
const tabFromHash = () => {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return validTabs.includes(h) ? h : 'dashboard';
};

function Workspace() {
  const { user, can, role } = useAccess();
  const [activeTab, setTab] = useState(tabFromHash);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const setActiveTab = (t: string) => { window.location.hash = `#/${t}`; setTab(t); };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (!user) return <LoginScreen />;

  const renderContent = () => {
    if (!can(activeTab, 'read')) return <AccessRestricted module={activeTab} onBack={() => setActiveTab('dashboard')} />;
    switch (activeTab) {
      case 'employees': return <EmployeeManagement />;
      case 'attendance': return <AttendanceLeave />;
      case 'payroll': return <PayrollManagement />;
      case 'recruitment': return <RecruitmentManagement />;
      case 'performance': return <PerformanceManagement />;
      case 'engagement': return <EmployeeEngagement />;
      case 'ai-assistant': return <AIAssistant />;
      case 'notifications': return <NotificationsPage />;
      case 'access': return <AccessControl />;
      case 'audit': return <AuditLogs />;
      case 'settings': return <SettingsPage />;
      default:
        return role === 'admin' ? (
          <DashboardOverview go={setActiveTab} />
        ) : role === 'hr' ? (
          <HRDashboard go={setActiveTab} />
        ) : (
          <EmployeeDashboard go={setActiveTab} />
        );
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <BrandProvider>
      <AccessProvider>
        <CurrencyProvider>
          <Workspace />
          <Toaster />
        </CurrencyProvider>
      </AccessProvider>
    </BrandProvider>
  );
}