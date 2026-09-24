'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { User, Calendar, FileText, MessageSquare, AlertCircle, List, Calculator, Newspaper, FlaskConical, Tag, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { MedicalCalculators } from './patient/MedicalCalculators';
import { PatientMedicalNews } from './patient/PatientMedicalNews';
import { PatientOffers, type PatientOffer } from './patient/PatientOffers';
import { PatientOfferModal } from './patient/PatientOfferModal';
import { PatientAppointments } from './patient/PatientAppointments';
import { PatientMedicalRecords } from './patient/PatientMedicalRecords';
import { PatientConsultations } from './patient/PatientConsultations';
import { PatientComplaints } from './patient/PatientComplaints';
import { PatientServices } from './patient/PatientServices';
import { PatientProfile } from './patient/PatientProfile';
import { PatientPrescriptions } from './patient/PatientPrescriptions';
import { PatientLabResults } from './patient/PatientLabResults';

const basePatientNav: SidebarItem[] = [
  { name: 'حجز المواعيد والسجلات', id: 'appointments', icon: Calendar },
  { name: 'خصومات وعروض', id: 'offers', icon: Tag },
  { name: 'البيانات الطبية', id: 'medical_data', icon: FileText },
  { name: 'استشارات', id: 'consultations', icon: MessageSquare },
  { name: 'الروشتات', id: 'prescriptions', icon: FileText },
  { name: 'سجل التحاليل', id: 'lab_results', icon: FlaskConical },
  { name: 'الأخبار الطبية', id: 'medical_news', icon: Newspaper },
  { name: 'الخدمات والأسعار', id: 'services', icon: List },
  { name: 'حاسبات طبية', id: 'calculators', icon: Calculator },
  { name: 'الشكاوى والمقترحات', id: 'complaints', icon: AlertCircle },
  { name: 'الملف الشخصي', id: 'profile', icon: User },
];

export function PatientDashboard({ user }: { user?: any }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab && basePatientNav.some(n => n.id === urlTab)) return urlTab;
    }
    return 'appointments';
  });
  const [activeOffers, setActiveOffers] = useState<PatientOffer[]>([]);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  // مزامنة التبويب النشط إذا تم الضغط على رابط في إشعار أو تغيير الرابط
  useEffect(() => {
    const handleUrlTab = (e?: Event) => {
      let targetTab: string | null = null;
      if (e && (e as CustomEvent).detail && typeof (e as CustomEvent).detail === 'string') {
        const detailUrl = (e as CustomEvent).detail;
        const qIndex = detailUrl.indexOf('?');
        if (qIndex !== -1) {
          targetTab = new URLSearchParams(detailUrl.slice(qIndex)).get('tab');
        }
      }
      if (!targetTab && typeof window !== 'undefined') {
        targetTab = new URLSearchParams(window.location.search).get('tab');
      }
      if (targetTab && basePatientNav.some(n => n.id === targetTab)) {
        setActiveTab(targetTab);
      }
    };

    window.addEventListener('popstate', handleUrlTab);
    window.addEventListener('app-route-change', handleUrlTab);
    return () => {
      window.removeEventListener('popstate', handleUrlTab);
      window.removeEventListener('app-route-change', handleUrlTab);
    };
  }, []);

  // جلب العروض السارية والمفعلة للتحقق من وجود عروض نشطة
  const fetchActiveOffers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('id, title, description, image_url, discount_percent, clinic_id, ends_at, clinic:clinic_id(name)')
        .eq('is_active', true)
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const offersList = (data as any) as PatientOffer[];
        setActiveOffers(offersList);

        // إظهار المودال التلقائي إذا لم يسبق للمريض إغلاقه خلال هذه الجلسة
        if (typeof window !== 'undefined') {
          const dismissed = sessionStorage.getItem('dismissed_offer_modal');
          if (!dismissed) {
            setIsOfferModalOpen(true);
          }
        }
      } else {
        setActiveOffers([]);
      }
    } catch {
      // تجاهل أخطاء الشبكة المؤقتة
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchActiveOffers, 0);
    // فحص دوري كل دقيقة لتحديث حالة العروض
    const interval = setInterval(fetchActiveOffers, 60000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [fetchActiveOffers]);

  // إغلاق المودال مع تذكر الإغلاق في الجلسة الحالية
  const handleCloseOfferModal = () => {
    setIsOfferModalOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dismissed_offer_modal', 'true');
    }
  };

  // حجز فوري بضغطة واحدة من داخل المودال أو من صفحة العروض
  const handleOneClickBook = async (offer: PatientOffer): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'يرجى تسجيل الدخول أولاً لتأكيد الحجز.' };
    }

    try {
      const discountLabel = offer.discount_percent != null ? ` (خصم ${offer.discount_percent}%)` : '';
      const clinicLabel = offer.clinic?.name ? ` - عيادة ${offer.clinic.name}` : '';
      const note = `حجز فوري للاستفادة من عرض: ${offer.title}${discountLabel}${clinicLabel}`;

      const { error } = await supabase.from('appointments').insert([
        {
          patient_id: user.id,
          clinic_id: offer.clinic_id || null,
          doctor_id: null,
          appointment_date: new Date().toISOString(),
          status: 'pending',
          notes: note,
        },
      ]);

      if (error) {
        return { 
          success: false, 
          error: getFriendlyErrorMessage(error, 'تعذر تسجيل الموعد، يرجى المحاولة لاحقاً.') 
        };
      }

      return { success: true };
    } catch (err: any) {
      return { 
        success: false, 
        error: getFriendlyErrorMessage(err, 'حدث خطأ أثناء تسجيل الحجز.') 
      };
    }
  };

  // قائمة التنقل الجانبية مع وميض وعلامة الخصم لتبويب العروض إذا وُجدت عروض نشطة
  const navItems = useMemo<SidebarItem[]>(() => {
    const hasOffers = activeOffers.length > 0;
    return basePatientNav.map((item) => {
      if (item.id === 'offers') {
        return {
          ...item,
          pulse: hasOffers,
          badge: hasOffers ? (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm">
              <Sparkles className="w-3 h-3 text-amber-200" />
              خصم %
            </span>
          ) : undefined,
        };
      }
      return item;
    });
  }, [activeOffers.length]);

  const renderContent = () => {
    switch (activeTab) {
      case 'appointments':
        return <PatientAppointments />;
      case 'offers':
        return (
          <PatientOffers 
            onBookOffer={handleOneClickBook} 
            onGoToAppointments={() => setActiveTab('appointments')}
          />
        );
      case 'medical_data': return <PatientMedicalRecords />;
      case 'consultations': return <PatientConsultations />;
      case 'prescriptions': return <PatientPrescriptions />;
      case 'lab_results': return <PatientLabResults />;
      case 'medical_news': return <PatientMedicalNews />;
      case 'services': return <PatientServices />;
      case 'calculators': return <MedicalCalculators />;
      case 'complaints': return <PatientComplaints />;
      case 'profile': return <PatientProfile />;
      default: return (
        <>
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{basePatientNav.find(n => n.id === activeTab)?.name}</h2>
          <Card>
            <CardHeader>
              <CardTitle>واجهة {basePatientNav.find(n => n.id === activeTab)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول {activeTab}).</p>
            </CardContent>
          </Card>
        </>
      );
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* نافذة الإعلان المنبثقة التلقائية عند فتح التطبيق مع إمكانية الإغلاق والحجز بضغطة واحدة */}
      <PatientOfferModal
        isOpen={isOfferModalOpen}
        onClose={handleCloseOfferModal}
        offers={activeOffers}
        onBookOffer={handleOneClickBook}
        onGoToAppointments={() => {
          handleCloseOfferModal();
          setActiveTab('appointments');
        }}
      />

      {/* القائمة الجانبية مع دعم وميض وعلامة الخصومات */}
      <Sidebar items={navItems} activeItem={activeTab} setActiveItem={setActiveTab} />
      
      <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {user?.patient_code && (
            <div className="mb-6 bg-white border-2 border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right shadow-sm">
              <div>
                <h3 className="text-gray-500 font-bold text-sm">مرحباً بك</h3>
                <p className="text-xl font-bold text-gray-800">{user.first_name} {user.last_name}</p>
              </div>
              <div className="text-center sm:text-left bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100 w-full sm:w-auto">
                <p className="text-emerald-700 font-bold text-sm mb-1">الكود الطبي الخاص بك</p>
                <p className="text-3xl font-black text-emerald-600 font-mono tracking-widest">{user.patient_code}</p>
              </div>
            </div>
          )}
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
