'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { User, Calendar, FileText, MessageSquare, AlertCircle, List, Calculator, Newspaper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { MedicalCalculators } from './patient/MedicalCalculators';
import { PatientMedicalNews } from './patient/PatientMedicalNews';

const patientNav: SidebarItem[] = [
  { name: 'حجز المواعيد والسجلات', id: 'appointments', icon: Calendar },
  { name: 'البيانات الطبية', id: 'medical_data', icon: FileText },
  { name: 'استشارات', id: 'consultations', icon: MessageSquare },
  { name: 'الأخبار الطبية', id: 'medical_news', icon: Newspaper },
  { name: 'الخدمات والأسعار', id: 'services', icon: List },
  { name: 'حاسبات طبية', id: 'calculators', icon: Calculator },
  { name: 'الشكاوى والمقترحات', id: 'complaints', icon: AlertCircle },
  { name: 'الملف الشخصي', id: 'profile', icon: User },
];

export function PatientDashboard({ user }: { user?: any }) {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={patientNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {user?.patient_code && (
            <div className="mb-6 bg-white border-2 border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-gray-500 font-bold text-sm">مرحباً بك</h3>
                <p className="text-xl font-bold text-gray-800">{user.first_name} {user.last_name}</p>
              </div>
              <div className="text-left bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">
                <p className="text-emerald-700 font-bold text-sm mb-1">الكود الطبي الخاص بك</p>
                <p className="text-3xl font-black text-emerald-600 font-mono tracking-widest">{user.patient_code}</p>
              </div>
            </div>
          )}
          
          {activeTab === 'calculators' ? (
            <MedicalCalculators />
          ) : activeTab === 'medical_news' ? (
            <PatientMedicalNews />
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

