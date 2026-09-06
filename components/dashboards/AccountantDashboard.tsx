'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { Calculator, BarChart, FileText } from 'lucide-react';

import { AccountantOverview } from './accountant/AccountantOverview';
import { AccountantExpenses } from './accountant/AccountantExpenses';
import { AccountantReports } from './accountant/AccountantReports';

const accountantNav: SidebarItem[] = [
  { name: 'لوحة الحسابات', id: 'dashboard', icon: Calculator },
  { name: 'المصروفات والمستهلكات', id: 'expenses', icon: FileText },
  { name: 'التقارير التحليلية', id: 'reports', icon: BarChart },
];

export function AccountantDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AccountantOverview />;
      case 'expenses': return <AccountantExpenses />;
      case 'reports': return <AccountantReports />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full">
      <Sidebar items={accountantNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-3 sm:p-4 md:p-8 pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto full-bleed-cap">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
