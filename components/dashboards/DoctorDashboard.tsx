'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { User, Activity, Calculator, Calendar, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

import { DoctorAppointments } from './doctor/DoctorAppointments';
import { DoctorCallQueue } from './doctor/DoctorCallQueue';
import { DoctorConsultations } from './doctor/DoctorConsultations';
import { DoctorFinancials } from './doctor/DoctorFinancials';
import { DoctorProfile } from './doctor/DoctorProfile';

const doctorNav: SidebarItem[] = [
  { name: 'المواعيد', id: 'appointments', icon: Calendar },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الاستشارات', id: 'consultations', icon: MessageSquare },
  { name: 'الحسابات', id: 'financials', icon: Calculator },
  { name: 'الملف الشخصي', id: 'profile', icon: User },
];

export function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  const renderContent = () => {
    switch (activeTab) {
      case 'appointments': return <DoctorAppointments />;
      case 'call_queue': return <DoctorCallQueue />;
      case 'consultations': return <DoctorConsultations />;
      case 'financials': return <DoctorFinancials />;
      case 'profile': return <DoctorProfile />;
      default: return (
        <Card>
          <CardHeader>
            <CardTitle>واجهة {doctorNav.find(n => n.id === activeTab)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">مرحباً دكتور، سيتم سحب وعرض بيانات ({activeTab}) الخاصة بك من قاعدة البيانات.</p>
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full">
      <Sidebar items={doctorNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-3 sm:p-4 md:p-8 pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto full-bleed-cap">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
