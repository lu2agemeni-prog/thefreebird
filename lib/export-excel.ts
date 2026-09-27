// ============================================================================
// lib/export-excel.ts
// تصدير أي مصفوفة بيانات كملف إكسيل (.xlsx) مع دعم كامل للغة العربية (RTL)
// وضبط أوتوماتيكي لعروض الأعمدة وتنسيق الجداول.
// ============================================================================
import * as XLSX from 'xlsx';

export interface ExcelSheetConfig {
  sheetName: string;
  rows: Record<string, any>[];
  columnWidths?: Record<string, number>;
}

/**
 * دالة مساعدة لضبط عرض الأعمدة أوتوماتيكياً بناءً على أطول نص ورأس العمود
 */
function autoFitColumns(rows: Record<string, any>[], explicitWidths?: Record<string, number>) {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    if (explicitWidths && explicitWidths[key]) {
      return { wch: explicitWidths[key] };
    }
    // حساب طول رأس العمود
    let maxLen = String(key || '').length;
    // فحص عينات من الصفوف
    const sample = rows.slice(0, 100);
    for (const r of sample) {
      const val = r[key];
      const valStr = val === null || val === undefined ? '' : String(val);
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    }
    // إضافة مساحة أمان للغة العربية
    return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
  });
}

/**
 * تصدير ورقة واحدة إلى ملف إكسيل مع RTL وعروض أعمدة مناسبة
 */
export function exportRowsToExcel(
  rows: Record<string, any>[],
  sheetName: string,
  fileName: string,
  explicitWidths?: Record<string, number>
): boolean {
  if (!rows || rows.length === 0) {
    return false;
  }

  const ws = XLSX.utils.json_to_sheet(rows);

  // تفعيل الاتجاه من اليمين لليسار للغة العربية في إكسيل
  ws['!views'] = [{ rightToLeft: true }];

  // ضبط عروض الأعمدة
  ws['!cols'] = autoFitColumns(rows, explicitWidths);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // أقصى طول لاسم الورقة 31 حرفاً

  // تصدير الملف
  XLSX.writeFile(wb, `${fileName}.xlsx`);
  return true;
}

/**
 * تصدير ملف إكسيل يحتوي على أوراق متعددة (Multi-sheet)
 */
export function exportMultiSheetExcel(sheets: ExcelSheetConfig[], fileName: string): boolean {
  if (!sheets || sheets.length === 0) {
    return false;
  }

  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    if (s.rows && s.rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(s.rows);
      ws['!views'] = [{ rightToLeft: true }];
      ws['!cols'] = autoFitColumns(s.rows, s.columnWidths);
      XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31));
    }
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
  return true;
}
