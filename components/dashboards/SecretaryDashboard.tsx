'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { Users, Activity, Calendar } from 'lucide-react';

import { SecretaryAppointments } from './secretary/SecretaryAppointments';
import { SecretaryPatients } from './secretary/SecretaryPatients';
import { SecretaryCallQueue } from './secretary/SecretaryCallQueue';

const secretaryNav: SidebarItem[] = [
  { name: 'إدارة المواعيد', id: 'appointments', icon: Calendar },
  { name: 'دليل المرضى', id: 'patients', icon: Users },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
];

export function SecretaryDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  const renderContent = () => {
    switch (activeTab) {
      case 'appointments': return <SecretaryAppointments />;
      case 'patients': return <SecretaryPatients />;
      case 'call_queue': return <SecretaryCallQueue />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar items={secretaryNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
