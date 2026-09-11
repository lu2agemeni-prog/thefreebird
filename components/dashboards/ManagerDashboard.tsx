'use client';

// ============================================================================
// components/dashboards/ManagerDashboard.tsx
// كان ملف واحد بـ1748 سطر (كل التبويبات + كل الحالة + كل الاستعلامات في
// نفس المكان). اتقسّم إلى مكونات مستقلة تحت components/dashboards/manager/tabs/
// — كل تبويب بيجيب بياناته لوحده (بنفس النمط المتبع في SecretaryCallQueue
// وClinicDetail وDoctorDetail وQueueMediaManager أصلًا). الملف ده بقى
// مجرد "قشرة" (shell): الشريط الجانبي + التبديل بين التبويبات، من غير أي
// منطق جلب بيانات بنفسه.
// ============================================================================
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import {
  Building, Calculator, Stethoscope, Activity, QrCode, Shield,
  BarChart, FileText, Newspaper, List, FlaskConical,
} from 'lucide-react';
import { SecretaryCallQueue } from './secretary/SecretaryCallQueue';
import { QueueMediaManager } from './manager/QueueMediaManager';
import { DashboardOverviewTab } from './manager/tabs/DashboardOverviewTab';
import { DoctorsTab } from './manager/tabs/DoctorsTab';
import { ClinicsTab } from './manager/tabs/ClinicsTab';
import { StaffManagementTab } from './manager/tabs/StaffManagementTab';
import { MedicalRecordsTab } from './manager/tabs/MedicalRecordsTab';
import { QRCodesTab } from './manager/tabs/QRCodesTab';
import { ServicesTab } from './manager/tabs/ServicesTab';
import { MedicalNewsTab } from './manager/tabs/MedicalNewsTab';
import { FinancialsTab } from './manager/tabs/FinancialsTab';
import { ReportsTab } from './manager/tabs/ReportsTab';
import { LabTab } from './shared/LabTab';

const managerNav: SidebarItem[] = [
  { name: 'لوحة القيادة', id: 'dashboard', icon: Activity },
  { name: 'الملفات الطبية', id: 'medical_records', icon: FileText },
  { name: 'الأطباء', id: 'doctors', icon: Stethoscope },
  { name: 'العيادات', id: 'clinics', icon: Building },
  { name: 'صلاحيات المستخدمين', id: 'staff_management', icon: Shield },
  { name: 'الخدمات والأسعار', id: 'services', icon: List },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'وسائط شاشة النداء', id: 'queue_media', icon: List },
  { name: 'المعمل', id: 'lab', icon: FlaskConical },
  { name: 'الماليات والأرباح', id: 'financials', icon: Calculator },
  { name: 'الأخبار الطبية', id: 'medical_news', icon: Newspaper },
  { name: 'التقارير الشاملة', id: 'reports', icon: BarChart },
  { name: 'QR Codes', id: 'qrcodes', icon: QrCode },
];

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={managerNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{managerNav.find(n => n.id === activeTab)?.name}</h2>

          {activeTab === 'dashboard' && <DashboardOverviewTab />}
          {activeTab === 'doctors' && <DoctorsTab />}
          {activeTab === 'clinics' && <ClinicsTab />}
          {activeTab === 'staff_management' && <StaffManagementTab />}
          {activeTab === 'medical_records' && <MedicalRecordsTab />}
          {activeTab === 'qrcodes' && <QRCodesTab />}
          {activeTab === 'services' && <ServicesTab />}
          {activeTab === 'medical_news' && <MedicalNewsTab />}
          {activeTab === 'call_queue' && <SecretaryCallQueue />}
          {activeTab === 'queue_media' && <QueueMediaManager />}
          {activeTab === 'lab' && <LabTab />}
          {activeTab === 'financials' && <FinancialsTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </div>
  );
}
