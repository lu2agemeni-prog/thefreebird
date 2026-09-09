'use client';

// ============================================================================
// components/dashboards/secretary/ServicePicker.tsx
// اختيار خدمة من خدمات العيادة المحددة، أو كتابة خدمة مخصّصة بسعر معيّن
// مع خيار حفظها في قائمة الخدمات للعيادة دي عشان تظهر تلقائيًا بعد كده.
// ============================================================================

export interface ServicePickerValue {
  serviceId: string;      // '' لو مفيش اختيار أو خدمة مخصّصة
  customName: string;     // متعبّى لو اختار "خدمة أخرى"
  price: string;          // سعر الخدمة المخصّصة
  saveToCatalog: boolean; // يحفظها في قائمة الخدمات ولا لأ
}

interface ServicePickerProps {
  clinicId: string;
  services: any[]; // كل الخدمات (هيتم فلترتها حسب clinicId هنا)
  value: ServicePickerValue;
  onChange: (value: ServicePickerValue) => void;
}

export const EMPTY_SERVICE_VALUE: ServicePickerValue = {
  serviceId: '', customName: '', price: '', saveToCatalog: false,
};

const OTHER_OPTION = '__other__';

export function ServicePicker({ clinicId, services, value, onChange }: ServicePickerProps) {
  const clinicServices = services.filter(s => s.clinic_id === clinicId);
  const isOther = value.serviceId === OTHER_OPTION;

  return (
    <div>
      <select
        value={value.serviceId}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === OTHER_OPTION
            ? { serviceId: OTHER_OPTION, customName: '', price: '', saveToCatalog: false }
            : { serviceId: v, customName: '', price: '', saveToCatalog: false });
        }}
        className="w-full border rounded-lg p-3 bg-white"
        disabled={!clinicId}
      >
        <option value="">-- بدون تحديد --</option>
        {clinicServices.map(s => (
          <option key={s.id} value={s.id}>{s.name} ({s.price} ج.م)</option>
        ))}
        <option value={OTHER_OPTION}>خدمة أخرى...</option>
      </select>

      {isOther && (
        <div className="mt-2 space-y-2 bg-gray-50 p-3 rounded-lg">
          <input
            type="text"
            placeholder="اسم الخدمة"
            value={value.customName}
            onChange={(e) => onChange({ ...value, customName: e.target.value })}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="السعر"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={value.saveToCatalog}
              onChange={(e) => onChange({ ...value, saveToCatalog: e.target.checked })}
            />
            حفظها في قائمة خدمات هذه العيادة للمستقبل
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * لو المستخدم كتب خدمة مخصّصة وحدد "حفظها"، ده بيضيفها لجدول services
 * ويرجّع الـ id بتاعها عشان تتربط بيها. غير كده بيرجّع serviceId الحالي
 * (أو null لو مفيش اختيار خالص).
 */
export async function resolveServiceSelection(
  supabase: any,
  clinicId: string,
  value: ServicePickerValue
): Promise<{ serviceId: string | null; customName: string | null; price: number }> {
  if (value.serviceId === OTHER_OPTION) {
    const price = parseFloat(value.price) || 0;
    if (value.saveToCatalog && value.customName.trim()) {
      const { data, error } = await supabase
        .from('services')
        .insert([{ clinic_id: clinicId, name: value.customName.trim(), price, is_active: true }])
        .select()
        .single();
      if (!error && data) {
        return { serviceId: data.id, customName: null, price };
      }
    }
    return { serviceId: null, customName: value.customName.trim() || null, price };
  }
  return { serviceId: value.serviceId || null, customName: null, price: 0 };
}
