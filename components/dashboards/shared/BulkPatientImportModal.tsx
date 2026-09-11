'use client';

// ============================================================================
// components/dashboards/shared/BulkPatientImportModal.tsx
// رفع بيانات مرضى بالجملة من ملف إكسيل (.xlsx / .xls / .csv) — للسكرتارية
// والمدير. التحليل بيحصل في المتصفح (مكتبة xlsx)، والتحقق من عدم تكرار
// المرضى المسجلين بالفعل (بمقارنة رقم الهاتف) بيحصل في السيرفر
// (/api/manager/patients-import) قبل أي إدراج فعلي في قاعدة البيانات.
// ============================================================================
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { authFetchJson } from '@/lib/api-client';

interface BulkPatientImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  phone: string;
}

// أسماء أعمدة محتملة (عربي/إنجليزي) — عشان نقبل ملفات بصيغ مختلفة من غير
// ما نجبر المستخدم على نموذج معين بالحرف
const NAME_HEADERS = ['الاسم', 'اسم المريض', 'الاسم الكامل', 'name', 'patient name', 'full name'];
const PHONE_HEADERS = ['رقم الهاتف', 'الهاتف', 'رقم التليفون', 'التليفون', 'رقم الموبايل', 'الموبايل', 'phone', 'mobile', 'phone number'];

function findColumn(headerRow: any[], candidates: string[]): number {
  const normalized = headerRow.map(h => String(h ?? '').trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseWorkbook(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return [];

  let nameCol = findColumn(rows[0], NAME_HEADERS);
  let phoneCol = findColumn(rows[0], PHONE_HEADERS);
  let dataRows = rows.slice(1);

  // لو مفيش رؤوس أعمدة معروفة، نفترض العمود الأول = الاسم والتاني = الهاتف
  if (nameCol === -1) {
    nameCol = 0;
    phoneCol = phoneCol === -1 ? 1 : phoneCol;
    dataRows = rows; // مفيش صف عناوين نتجاهله
  }

  return dataRows
    .map(r => ({
      name: String(r[nameCol] ?? '').trim(),
      phone: phoneCol !== -1 ? String(r[phoneCol] ?? '').trim() : '',
    }))
    .filter(r => r.name);
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['الاسم', 'رقم الهاتف'],
    ['مثال: أحمد محمد علي', '01012345678'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المرضى');
  XLSX.writeFile(wb, 'نموذج_استيراد_المرضى.xlsx');
}

export function BulkPatientImportModal({ onClose, onImported }: BulkPatientImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; invalid: number; total: number } | null>(null);

  const handleFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      if (parsed.length === 0) {
        setParseError('لم يتم العثور على أي صفوف صالحة في الملف — تأكد إن عمود الاسم موجود.');
        setRows([]);
        return;
      }
      setRows(parsed);
    } catch (err) {
      setParseError('تعذر قراءة الملف — تأكد إنه بصيغة Excel (.xlsx/.xls) أو CSV صحيحة.');
      setRows([]);
    }
  };

  const handleSubmit = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const { data, error } = await authFetchJson('/api/manager/patients-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    setResult(data);
    onImported();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            استيراد مرضى من ملف إكسيل
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-800">تم استيراد {result.inserted} مريض جديد بنجاح.</p>
                  <p className="text-sm text-emerald-700">
                    {result.duplicates > 0 && `${result.duplicates} صف تم تخطيه (مريض مسجل بالفعل بنفس رقم الهاتف). `}
                    {result.invalid > 0 && `${result.invalid} صف غير صالح (بدون اسم) تم تجاهله. `}
                    من إجمالي {result.total} صف في الملف.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700">
                تم
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors w-fit"
              >
                <Download className="w-4 h-4" />
                تحميل نموذج Excel فارغ
              </button>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-bold text-gray-600">{fileName || 'اضغط لاختيار ملف Excel أو CSV'}</span>
                <span className="text-xs text-gray-400">أعمدة مطلوبة: الاسم (إجباري)، رقم الهاتف (اختياري لكن يُستخدم لمنع التكرار)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>

              {parseError && <InlineError message={parseError} />}
              {submitError && <InlineError message={submitError} />}

              {rows.length > 0 && !parseError && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-700">
                    تم العثور على <span className="text-emerald-600">{rows.length}</span> صف صالح في الملف. معاينة أول 5:
                  </p>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-right">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 font-semibold text-gray-600">الاسم</th>
                          <th className="p-2 font-semibold text-gray-600">الهاتف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2 text-gray-800">{r.name}</td>
                            <td className="p-2 text-gray-500" dir="ltr">{r.phone || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    استيراد {rows.length} مريض
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
