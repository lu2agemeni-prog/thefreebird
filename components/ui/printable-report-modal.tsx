'use client';

import React, { useEffect, useState } from 'react';
import { Printer, X, FileText, CheckCircle2, Loader2 } from 'lucide-react';

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
  isLoading?: boolean;
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
  isLoading = false,
}: PrintableReportModalProps) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (isLoading) return;
    setPrinting(true);

    const printContent = document.getElementById('printable-report-content');
    if (printContent) {
      try {
        let iframe = document.getElementById('report-print-isolated-iframe') as HTMLIFrameElement | null;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'report-print-isolated-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          iframe.style.zIndex = '-9999';
          document.body.appendChild(iframe);
        }

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8">
              <title>${title || 'تقرير مالي'}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 12mm 10mm 15mm 10mm;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
                  margin: 0;
                  padding: 0;
                  color: #111827;
                  background: #ffffff;
                  font-size: 11px;
                  line-height: 1.4;
                  direction: rtl;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  page-break-inside: auto;
                  margin-top: 8px;
                }
                thead {
                  display: table-header-group;
                }
                tfoot {
                  display: table-footer-group;
                }
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                th {
                  background-color: #f3f4f6 !important;
                  color: #1f2937;
                  font-weight: 700;
                  border: 1px solid #d1d5db;
                  padding: 6px 8px;
                  font-size: 10.5px;
                  text-align: right;
                }
                td {
                  border: 1px solid #e5e7eb;
                  padding: 5px 8px;
                  font-size: 10px;
                }
                .avoid-page-break {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                .text-center { text-align: center; }
                .text-left { text-align: left; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .font-black { font-weight: 900; }
                .text-emerald-600 { color: #059669; }
                .text-emerald-700 { color: #047857; }
                .text-emerald-800 { color: #065f46; }
                .text-red-600 { color: #dc2626; }
                .text-red-700 { color: #b91c1c; }
                .text-gray-400 { color: #9ca3af; }
                .text-gray-500 { color: #6b7280; }
                .text-gray-600 { color: #4b5563; }
                .text-gray-700 { color: #374151; }
                .text-gray-800 { color: #1f2937; }
                .text-gray-900 { color: #111827; }
                .bg-emerald-50 { background-color: #ecfdf5 !important; }
                .bg-gray-50 { background-color: #f9fafb !important; }
                .bg-white { background-color: #ffffff !important; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
            </html>
          `);
          doc.close();

          setTimeout(() => {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
            setPrinting(false);
          }, 300);
          return;
        }
      } catch (err) {
        console.warn('Isolated iframe print failed, falling back to window.print()', err);
      }
    }

    window.print();
    setPrinting(false);
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
              <p className="text-xs text-gray-500">جاهز للطباعة أو الحفظ كملف PDF عالي الجودة يدعم اللغة العربية ومقاس A4</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || printing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              {printing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الطباعة...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>طباعة / حفظ كـ PDF</span>
                </>
              )}
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
          <div className="border-b-2 border-emerald-600 pb-4 flex items-start justify-between avoid-page-break">
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
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/90 rounded-xl p-3 border border-gray-100 text-xs avoid-page-break">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4 avoid-page-break">
              {summaryCards.map((card, idx) => (
                <div key={idx} className="bg-white border rounded-xl p-3.5 shadow-xs text-center border-t-2 border-t-emerald-600">
                  <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
                  <p className="text-xl font-black text-gray-900" dir="ltr">{card.value}</p>
                  {card.sub && <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Loading Indicator inside modal */}
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-gray-700">جاري تجميع وتنسيق كافة بيانات الشهر المالي / الفترة للطباعة...</p>
              <p className="text-xs text-gray-400">سيتم تجهيز التقرير بجميع الحركات تلقائياً بمقاس A4</p>
            </div>
          )}

          {/* Custom Content */}
          {!isLoading && children}

          {/* Standard Sections */}
          {!isLoading && sections && sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-2 pt-2">
              {sec.title && (
                <div className="border-r-4 border-emerald-600 pr-2 avoid-page-break">
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
                          <td className="p-2 text-center text-gray-400 font-mono text-[11px]">{rIdx + 1}</td>
                          {sec.columns.map((col, cIdx) => (
                            <td
                              key={cIdx}
                              className={`p-2 ${
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
          <div className="pt-8 mt-6 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-end print:pt-6 avoid-page-break">
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
            <span>يدعم حفظ PDF المباشر عبر أمر الطباعة (Save as PDF) بمقاس A4</span>
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
              disabled={isLoading || printing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {printing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحضير...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>طباعة المستند</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

