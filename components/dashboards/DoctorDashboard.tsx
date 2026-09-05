'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { User, Activity, Calculator, Calendar, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const doctorNav: SidebarItem[] = [
  { name: 'المواعيد', id: 'appointments', icon: Calendar },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الاستشارات', id: 'consultations', icon: MessageSquare },
  { name: 'الحسابات', id: 'financials', icon: Calculator },
  { name: 'الملف الشخصي', id: 'profile', icon: User },
];

export function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={doctorNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{doctorNav.find(n => n.id === activeTab)?.name}</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>واجهة {doctorNav.find(n => n.id === activeTab)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">مرحباً دكتور، سيتم سحب وعرض بيانات ({activeTab}) الخاصة بك من قاعدة البيانات.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
