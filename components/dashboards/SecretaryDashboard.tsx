'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { Users, Activity, Calendar, FlaskConical } from 'lucide-react';

import { SecretaryAppointments } from './secretary/SecretaryAppointments';
import { SecretaryPatients } from './secretary/SecretaryPatients';
import { SecretaryCallQueue } from './secretary/SecretaryCallQueue';
import { LabTab } from './shared/LabTab';

const secretaryNav: SidebarItem[] = [
  { name: 'إدارة المواعيد', id: 'appointments', icon: Calendar },
  { name: 'دليل المرضى', id: 'patients', icon: Users },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'المعمل', id: 'lab', icon: FlaskConical },
];

export function SecretaryDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  const renderContent = () => {
    switch (activeTab) {
      case 'appointments': return <SecretaryAppointments />;
      case 'patients': return <SecretaryPatients />;
      case 'call_queue': return <SecretaryCallQueue />;
      case 'lab': return <LabTab />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar items={secretaryNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
