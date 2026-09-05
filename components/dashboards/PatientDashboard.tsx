'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { User, Calendar, FileText, MessageSquare, AlertCircle, List, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { MedicalCalculators } from './patient/MedicalCalculators';

const patientNav: SidebarItem[] = [
  { name: 'حجز المواعيد والسجلات', id: 'appointments', icon: Calendar },
  { name: 'البيانات الطبية', id: 'medical_data', icon: FileText },
  { name: 'استشارات', id: 'consultations', icon: MessageSquare },
  { name: 'الخدمات والأسعار', id: 'services', icon: List },
  { name: 'حاسبات طبية', id: 'calculators', icon: Calculator },
  { name: 'الشكاوى والمقترحات', id: 'complaints', icon: AlertCircle },
  { name: 'الملف الشخصي', id: 'profile', icon: User },
];

export function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={patientNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          
          {activeTab === 'calculators' ? (
            <MedicalCalculators />
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-800 mb-8">{patientNav.find(n => n.id === activeTab)?.name}</h2>
              <Card>
                <CardHeader>
                  <CardTitle>واجهة {patientNav.find(n => n.id === activeTab)?.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول {activeTab}).</p>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

