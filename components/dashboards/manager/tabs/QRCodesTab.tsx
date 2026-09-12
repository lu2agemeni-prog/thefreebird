'use client';

// ============================================================================
// components/dashboards/manager/tabs/QRCodesTab.tsx
// تبويب "QR Codes" — مستخرج من ManagerDashboard.tsx بنفس السلوك بالضبط.
// ============================================================================
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';

function QRCodeCard({ title, url, desc }: { title: string; url: string; desc: string }) {
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

export function QRCodesTab() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <QRCodeCard title="لائحة الأسعار" url={`${origin}/prices`} desc="QR Code لصفحة الأسعار والخدمات" />
      <QRCodeCard title="الشكاوى والاقتراحات" url={`${origin}/public/complaints`} desc="QR Code لنموذج الشكاوى والمقترحات" />
      <QRCodeCard title="واي فاي العيادة" url={`${origin}/wifi`} desc="QR Code لصفحة بيانات الواي فاي للزوار" />
      <QRCodeCard title="الحجز السريع" url={`${origin}/book`} desc="QR Code لحجز موعد في العيادات" />
      <QRCodeCard title="شاشة النداء الآلي" url={`${origin}/queue`} desc="QR Code لفتح شاشة العرض العامة على الشاشات الكبيرة" />
      <QRCodeCard title="أطباء المركز" url={`${origin}/doctors`} desc="QR Code لعرض الأطباء ومواعيدهم" />
    </div>
  );
}
