// ============================================================================
// lib/export-excel.ts
// تصدير أي مصفوفة بيانات كملف إكسيل قابل للتحميل — مستخدم في تقرير حسابات
// المعمل والحسابات الإضافية.
// ============================================================================
import * as XLSX from 'xlsx';

export function exportRowsToExcel(rows: Record<string, any>[], sheetName: string, fileName: string) {
  if (!rows || rows.length === 0) {
    alert('لا توجد بيانات لتصديرها.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
