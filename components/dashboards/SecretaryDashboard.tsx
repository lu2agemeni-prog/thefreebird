'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { UserPlus, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const secretaryNav: SidebarItem[] = [
  { name: 'إضافة زائر وتسجيل', id: 'add_patient', icon: UserPlus },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
];

export function SecretaryDashboard() {
  const [activeTab, setActiveTab] = useState('add_patient');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={secretaryNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{secretaryNav.find(n => n.id === activeTab)?.name}</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>واجهة {secretaryNav.find(n => n.id === activeTab)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول {activeTab}).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
