'use client';

import React, { useEffect } from 'react';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

export interface ReportSection {
  title?: string;
  description?: string;
  columns: {
    header: string;
    key?: string;
    align?: 'right' | 'center' | 'left';
    render?: (row: any, index: number) => React.ReactNode;
  }[];
  data: any[];
  emptyMessage?: string;
  totals?: { [key: string]: string | number };
}

export interface PrintableReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dateRange?: { from: string; to: string };
  metaItems?: { label: string; value: string }[];
  summaryCards?: { label: string; value: string; sub?: string }[];
  sections?: ReportSection[];
  children?: React.ReactNode;
}

export function PrintableReportModal({
  isOpen,
  onClose,
  title,
  subtitle,
  dateRange,
  metaItems,
  summaryCards,
  sections,
  children,
}: PrintableReportModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col overflow-hidden border border-gray-200 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">معاينة التقرير والطباعة / PDF</h2>
              <p className="text-xs text-gray-500">جاهز للطباعة أو الحفظ كملف PDF عالي الجودة يدعم اللغة العربية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ كـ PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div
          id="printable-report-content"
          className="p-6 md:p-8 space-y-6 text-right print:p-0 print:space-y-4"
          dir="rtl"
        >
          {/* Header */}
          <div className="border-b-2 border-emerald-600 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                <span className="text-xs font-bold text-emerald-700 tracking-wider">المنظومة الطبية الذكية — إدارة المركز</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-gray-600 font-medium">{subtitle}</p>}
            </div>

            <div className="text-left text-xs text-gray-500 space-y-1 border-r pr-4 border-gray-100 print:text-[11px]">
              <p className="font-bold text-gray-800">مجمع عيادات كير التخصصي</p>
              <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>التوقيت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Date range & Meta badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/90 rounded-xl p-3 border border-gray-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-600">الفترة الزمنية:</span>
              {dateRange ? (
                <span className="bg-white px-2.5 py-1 rounded-lg border font-mono font-bold text-emerald-800" dir="ltr">
                  {dateRange.from} &nbsp;➔&nbsp; {dateRange.to}
                </span>
              ) : (
                <span className="text-gray-500">كل الفترات</span>
              )}
            </div>

            {metaItems && metaItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {metaItems.map((m, idx) => (
                  <span key={idx} className="bg-white px-2.5 py-1 rounded-lg border text-gray-700">
                    <strong className="text-gray-500 ml-1">{m.label}:</strong> {m.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Summary KPI Cards */}
          {summaryCards && summaryCards.length > 0 && (
            <div className={`grid grid-cols-2 md:grid-cols-${Math.min(summaryCards.length, 4)} gap-3 print:grid-cols-3`}>
              {summaryCards.map((card, idx) => (
                <div key={idx} className="bg-white border rounded-xl p-3.5 shadow-xs text-center border-t-2 border-t-emerald-600">
                  <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
                  <p className="text-xl font-black text-gray-900" dir="ltr">{card.value}</p>
                  {card.sub && <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Custom Content */}
          {children}

          {/* Standard Sections */}
          {sections && sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-2 pt-2">
              {sec.title && (
                <div className="border-r-4 border-emerald-600 pr-2">
                  <h3 className="font-bold text-gray-800 text-sm">{sec.title}</h3>
                  {sec.description && <p className="text-xs text-gray-500">{sec.description}</p>}
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-700 border-b border-gray-200">
                      <th className="p-2.5 font-bold w-10 text-center">#</th>
                      {sec.columns.map((col, colIdx) => (
                        <th
                          key={colIdx}
                          className={`p-2.5 font-bold ${
                            col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sec.data.length === 0 ? (
                      <tr>
                        <td colSpan={sec.columns.length + 1} className="p-6 text-center text-gray-400">
                          {sec.emptyMessage || 'لا توجد بيانات متاحة لهذا القسم'}
                        </td>
                      </tr>
                    ) : (
                      sec.data.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}>
                          <td className="p-2.5 text-center text-gray-400 font-mono text-[11px]">{rIdx + 1}</td>
                          {sec.columns.map((col, cIdx) => (
                            <td
                              key={cIdx}
                              className={`p-2.5 ${
                                col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                              }`}
                            >
                              {col.render ? col.render(row, rIdx) : col.key ? String(row[col.key] ?? '') : ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Signatures & Footer (Print Only / Clean look) */}
          <div className="pt-8 mt-6 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-end print:pt-6">
            <div className="text-center space-y-6">
              <p className="font-bold text-gray-700">إعداد وتدقيق الحسابات</p>
              <div className="w-32 border-b border-gray-300"></div>
            </div>
            <div className="text-center space-y-6">
              <p className="font-bold text-gray-700">اعتماد إدارة المركز</p>
              <div className="w-32 border-b border-gray-300"></div>
            </div>
            <div className="text-center space-y-6">
              <p className="font-bold text-gray-700">الختم الرسمي</p>
              <div className="w-24 h-12 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-[10px] text-gray-400">
                خاتم المركز
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on print) */}
        <div className="print:hidden px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>يدعم حفظ PDF المباشر عبر أمر الطباعة (Save as PDF)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
