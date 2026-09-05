'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { 
  Settings, Users, Building, Calculator, 
  Stethoscope, CreditCard, Activity, QrCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { QRCodeSVG } from 'qrcode.react';

const managerNav: SidebarItem[] = [
  { name: 'لوحة القيادة', id: 'dashboard', icon: Activity },
  { name: 'الإعدادات العامة', id: 'settings', icon: Settings },
  { name: 'الأطباء', id: 'doctors', icon: Stethoscope },
  { name: 'العاملين', id: 'staff', icon: Users },
  { name: 'الحسابات', id: 'accounts', icon: CreditCard },
  { name: 'العيادات', id: 'clinics', icon: Building },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الماليات والأرباح', id: 'financials', icon: Calculator },
  { name: 'الخدمات والأسعار', id: 'services', icon: CreditCard },
  { name: 'QR Codes', id: 'qrcodes', icon: QrCode },
];

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={managerNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{managerNav.find(n => n.id === activeTab)?.name}</h2>
          
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="إجمالي الأطباء" value="12" icon={<Stethoscope />} />
              <StatCard title="العيادات النشطة" value="5" icon={<Building />} />
              <StatCard title="مرضى اليوم" value="48" icon={<Users />} />
              <StatCard title="إيرادات اليوم" value="4,500 ج.م" icon={<Calculator />} />
            </div>
          )}

          {activeTab === 'qrcodes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <QRCodeCard title="لائحة الأسعار" url="https://freebird.clinic/prices" desc="QR Code لصفحة الأسعار والخدمات" />
              <QRCodeCard title="الشكاوى والاقتراحات" url="https://freebird.clinic/complaints" desc="QR Code لنموذج الشكاوى والمقترحات" />
              <QRCodeCard title="واي فاي العيادة" url="WIFI:S:FreeBird_Guest;T:WPA;P:12345678;;" desc="QR Code للاتصال المباشر بشبكة الواي فاي" />
              <QRCodeCard title="العيادة الباطنية" url="https://freebird.clinic/book/internal" desc="QR Code لحجز موعد في العيادة الباطنية" />
            </div>
          )}
          
          {/* Add basic placeholders for other tabs to show it's wired up */}
          {activeTab !== 'dashboard' && activeTab !== 'qrcodes' && (
            <Card>
              <CardHeader>
                <CardTitle>جاري تحميل بيانات {managerNav.find(n => n.id === activeTab)?.name}...</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول {activeTab}).</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function QRCodeCard({ title, url, desc }: { title: string, url: string, desc: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6 bg-gray-50 m-6 rounded-lg border">
        <QRCodeSVG value={url} size={200} level="H" includeMargin={true} />
        <p className="mt-4 text-xs text-gray-400 font-mono break-all text-center">{url}</p>
        <button className="mt-4 text-emerald-600 font-medium text-sm border border-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
          طباعة
        </button>
      </CardContent>
    </Card>
  );
}
