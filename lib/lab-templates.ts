// ============================================================================
// lib/lab-templates.ts
// قوالب التحاليل الطبية الجاهزة للطباعة مع القيم المرجعية وطريقة الحساب
// ============================================================================

export interface LabTestField {
  id: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  defaultValue?: string | number;
  normalRange: string;
  normalMin?: number;
  normalMax?: number;
  options?: string[]; // للخيارات المحددة مثل البول
}

export interface LabTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  methodology?: string;
  notesDefault?: string;
  fields: LabTestField[];
  interpret?: (values: Record<string, string | number>) => {
    status: 'normal' | 'borderline' | 'abnormal' | 'high' | 'low';
    summaryAr: string;
    detailsAr: string;
  };
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'hba1c',
    titleAr: 'تحليل السكر التراكمي',
    titleEn: 'Glycosylated Hemoglobin (HbA1c)',
    category: 'السكري والميتابوليزم',
    methodology: 'HPLC / Enzymatic Turbidimetric (NGSP & IFCC Standardized)',
    notesDefault: 'يُنصح بإعادة فحص السكر التراكمي كل 3 أشهر لمتابعة فاعلية الخطة العلاجية وضبط الجرعات بالتنسيق مع الطبيب المعالج.',
    fields: [
      {
        id: 'hba1c_val',
        nameAr: 'نسبة السكر التراكمي (HbA1c)',
        nameEn: 'Glycosylated Hemoglobin (HbA1c)',
        unit: '%',
        defaultValue: '6.5',
        normalRange: '4.0 - 5.6 % (غير مصاب)',
        normalMin: 4.0,
        normalMax: 5.6,
      },
      {
        id: 'eag_val',
        nameAr: 'متوسط الجلوكوز التقديري (eAG)',
        nameEn: 'Estimated Average Glucose (eAG)',
        unit: 'mg/dL',
        defaultValue: '140',
        normalRange: '70 - 114 mg/dL',
        normalMin: 70,
        normalMax: 114,
      },
    ],
    interpret: (vals) => {
      const val = Number(vals['hba1c_val'] || 0);
      if (val < 4.0) {
        return {
          status: 'low',
          summaryAr: 'انخفاض في نسبة السكر التراكمي (< 4.0%)',
          detailsAr: 'قد يشير إلى هبوط متكرر في السكر أو أمراض دم أو أنيميا انحلالية، يُرجى استشارة الطبيب.',
        };
      }
      if (val <= 5.6) {
        return {
          status: 'normal',
          summaryAr: 'المعدل الطبيعي للأصحاء (4.0 - 5.6%)',
          detailsAr: 'المستوى طبيعي ولا توجد مؤشرات إصابة بداء السكري، يُنصح بالمحافظة على نمط الحياة الصحي.',
        };
      }
      if (val <= 6.4) {
        return {
          status: 'borderline',
          summaryAr: 'مرحلة ما قبل السكري - Prediabetes (5.7 - 6.4%)',
          detailsAr: 'ارتفاع في خطورة الإصابة بالسكري، يُوصى بتعديل النظام الغذائي وممارسة الرياضة والمتابعة الدورية.',
        };
      }
      if (val <= 7.0) {
        return {
          status: 'normal',
          summaryAr: 'سكري متحكم به ممتاز - Good Control (6.5 - 7.0%)',
          detailsAr: 'النتيجة تحقق الهدف العلاجي لمرضى السكري وفق توصيات الجمعية الأمريكية للسكري (ADA < 7.0%).',
        };
      }
      if (val <= 8.0) {
        return {
          status: 'borderline',
          summaryAr: 'سكري - تحكم متوسط مقبول (7.1 - 8.0%)',
          detailsAr: 'تحكم مقبول ولكن يحتاج إلى مزيد من الالتزام بالحمية الغذائية ومراجعة جرعات العلاج مع الطبيب.',
        };
      }
      return {
        status: 'high',
        summaryAr: 'سكري غير منضبط - Action Suggested (> 8.0%)',
        detailsAr: 'مستوى مرتفع يشير إلى ضعف التحكم في مستويات السكر وزيادة احتمالية المضاعفات. يتطلب مراجعة الطبيب الفورية لتعديل الخطة العلاجية.',
      };
    },
  },
  {
    id: 'glucose_fasting_random',
    titleAr: 'سكر الدم (صائم وعشوائي)',
    titleEn: 'Blood Glucose Profile (FBS / RBS)',
    category: 'السكري والميتابوليزم',
    methodology: 'Hexokinase / Glucose Oxidase Method',
    notesDefault: 'تم سحب العينة في شروط الصيام المحددة (8 - 10 ساعات للصائم).',
    fields: [
      {
        id: 'fbs',
        nameAr: 'السكر الصائم (FBS)',
        nameEn: 'Fasting Blood Sugar',
        unit: 'mg/dL',
        defaultValue: '95',
        normalRange: '70 - 100 mg/dL',
        normalMin: 70,
        normalMax: 100,
      },
      {
        id: 'rbs',
        nameAr: 'السكر العشوائي (RBS)',
        nameEn: 'Random Blood Sugar',
        unit: 'mg/dL',
        defaultValue: '120',
        normalRange: '70 - 140 mg/dL',
        normalMin: 70,
        normalMax: 140,
      },
      {
        id: 'ppbs',
        nameAr: 'السكر بعد الأكل بساعتين (2h PPBS)',
        nameEn: '2-Hour Postprandial Glucose',
        unit: 'mg/dL',
        defaultValue: '130',
        normalRange: '< 140 mg/dL',
        normalMin: 70,
        normalMax: 140,
      },
    ],
  },
  {
    id: 'rft',
    titleAr: 'وظائف الكلى الكاملة',
    titleEn: 'Kidney Function Tests (RFT)',
    category: 'الكلى والمسالك',
    methodology: 'Enzymatic / Jaffe Kinetic',
    notesDefault: 'معدل الترشيح الكبيبي المقدر (eGFR) طبيعي (> 90 mL/min/1.73m²).',
    fields: [
      {
        id: 'creatinine',
        nameAr: 'الكرياتينين في المصل (Serum Creatinine)',
        nameEn: 'Serum Creatinine',
        unit: 'mg/dL',
        defaultValue: '0.9',
        normalRange: '0.6 - 1.2 mg/dL (ذكور: 0.7 - 1.3 / إناث: 0.5 - 1.1)',
        normalMin: 0.6,
        normalMax: 1.2,
      },
      {
        id: 'blood_urea',
        nameAr: 'اليوريا في الدم (Blood Urea)',
        nameEn: 'Blood Urea',
        unit: 'mg/dL',
        defaultValue: '28',
        normalRange: '15 - 45 mg/dL',
        normalMin: 15,
        normalMax: 45,
      },
      {
        id: 'uric_acid',
        nameAr: 'حمض اليوريك (Serum Uric Acid)',
        nameEn: 'Uric Acid',
        unit: 'mg/dL',
        defaultValue: '4.8',
        normalRange: '3.5 - 7.2 mg/dL (ذكور) / 2.6 - 6.0 mg/dL (إناث)',
        normalMin: 3.5,
        normalMax: 7.2,
      },
      {
        id: 'egfr',
        nameAr: 'معدل الترشيح الكبيبي (eGFR)',
        nameEn: 'Estimated GFR',
        unit: 'mL/min/1.73m²',
        defaultValue: '98',
        normalRange: '> 90 mL/min/1.73m²',
        normalMin: 90,
        normalMax: 140,
      },
    ],
  },
  {
    id: 'lft',
    titleAr: 'وظائف الكبد الكاملة',
    titleEn: 'Liver Function Tests (LFT)',
    category: 'الجهاز الهضمي والكبد',
    methodology: 'IFCC UV with Pyridoxal Phosphate',
    notesDefault: 'أنزيمات الكبد والبروتينات في الحدود الطبيعية.',
    fields: [
      {
        id: 'sgpt',
        nameAr: 'إنزيم الكبد ALT (SGPT)',
        nameEn: 'Alanine Aminotransferase (ALT)',
        unit: 'U/L',
        defaultValue: '26',
        normalRange: 'Up to 45 U/L (ذكور: <50 / إناث: <35)',
        normalMin: 0,
        normalMax: 45,
      },
      {
        id: 'sgot',
        nameAr: 'إنزيم الكبد AST (SGOT)',
        nameEn: 'Aspartate Aminotransferase (AST)',
        unit: 'U/L',
        defaultValue: '24',
        normalRange: 'Up to 40 U/L (ذكور: <45 / إناث: <35)',
        normalMin: 0,
        normalMax: 40,
      },
      {
        id: 'total_bilirubin',
        nameAr: 'الصفراء الكلية (Total Bilirubin)',
        nameEn: 'Total Bilirubin',
        unit: 'mg/dL',
        defaultValue: '0.7',
        normalRange: '0.2 - 1.2 mg/dL',
        normalMin: 0.2,
        normalMax: 1.2,
      },
      {
        id: 'direct_bilirubin',
        nameAr: 'الصفراء المباشرة (Direct Bilirubin)',
        nameEn: 'Direct Bilirubin',
        unit: 'mg/dL',
        defaultValue: '0.15',
        normalRange: '0.0 - 0.3 mg/dL',
        normalMin: 0.0,
        normalMax: 0.3,
      },
      {
        id: 'albumin',
        nameAr: 'الزلال في الدم (Serum Albumin)',
        nameEn: 'Serum Albumin',
        unit: 'g/dL',
        defaultValue: '4.2',
        normalRange: '3.5 - 5.2 g/dL',
        normalMin: 3.5,
        normalMax: 5.2,
      },
      {
        id: 'alp',
        nameAr: 'الفوسفاتاز القلوي (Alkaline Phosphatase - ALP)',
        nameEn: 'Alkaline Phosphatase',
        unit: 'U/L',
        defaultValue: '78',
        normalRange: '44 - 147 U/L',
        normalMin: 44,
        normalMax: 147,
      },
    ],
  },
  {
    id: 'lipid_profile',
    titleAr: 'دهون الدم الشاملة',
    titleEn: 'Lipid Profile Panel',
    category: 'القلب والأوعية الدموية',
    methodology: 'Enzymatic Colorimetric (CHOD-PAP / GPO-PAP)',
    notesDefault: 'سُحبت العينة بعد صيام 10-12 ساعة.',
    fields: [
      {
        id: 'cholesterol',
        nameAr: 'الكوليسترول الكلي (Total Cholesterol)',
        nameEn: 'Total Cholesterol',
        unit: 'mg/dL',
        defaultValue: '175',
        normalRange: '< 200 mg/dL (مرغوب فيه)',
        normalMin: 0,
        normalMax: 200,
      },
      {
        id: 'triglycerides',
        nameAr: 'الدهون الثلاثية (Triglycerides)',
        nameEn: 'Serum Triglycerides',
        unit: 'mg/dL',
        defaultValue: '130',
        normalRange: '< 150 mg/dL (طبيعي)',
        normalMin: 0,
        normalMax: 150,
      },
      {
        id: 'hdl',
        nameAr: 'الكوليسترول النافع (HDL - High Density)',
        nameEn: 'HDL Cholesterol',
        unit: 'mg/dL',
        defaultValue: '52',
        normalRange: '> 40 mg/dL (ذكور) / > 50 mg/dL (إناث)',
        normalMin: 40,
        normalMax: 80,
      },
      {
        id: 'ldl',
        nameAr: 'الكوليسترول الضار (LDL - Low Density)',
        nameEn: 'LDL Cholesterol',
        unit: 'mg/dL',
        defaultValue: '98',
        normalRange: '< 100 mg/dL (مثالي) / 100-129 (مقبول)',
        normalMin: 0,
        normalMax: 100,
      },
      {
        id: 'risk_ratio',
        nameAr: 'مؤشر خطورة القلب (Total / HDL Ratio)',
        nameEn: 'Coronary Risk Ratio',
        unit: 'Ratio',
        defaultValue: '3.3',
        normalRange: '< 4.5 (منخفض الخطورة)',
        normalMin: 0,
        normalMax: 4.5,
      },
    ],
  },
  {
    id: 'cbc',
    titleAr: 'صورة الدم الكاملة',
    titleEn: 'Complete Blood Count (C.B.C)',
    category: 'أمراض الدم',
    methodology: 'Automated Hematology Analyzer (Flow Cytometry / Impedance)',
    notesDefault: 'مكونات الدم ضمن المعدلات الطبيعية المتوافقة مع العمر والجنس.',
    fields: [
      {
        id: 'hb',
        nameAr: 'الهيموجلوبين (Hemoglobin - Hb)',
        nameEn: 'Hemoglobin (Hb)',
        unit: 'g/dL',
        defaultValue: '14.2',
        normalRange: '13.0 - 17.5 (ذكور) / 12.0 - 15.5 (إناث)',
        normalMin: 12.0,
        normalMax: 17.5,
      },
      {
        id: 'rbc',
        nameAr: 'كرات الدم الحمراء (RBC Count)',
        nameEn: 'Red Blood Cells Count',
        unit: '×10⁶/µL',
        defaultValue: '4.8',
        normalRange: '4.5 - 5.9 (ذكور) / 4.0 - 5.2 (إناث)',
        normalMin: 4.0,
        normalMax: 5.9,
      },
      {
        id: 'hct',
        nameAr: 'حجم الخلايا المتكدسة (Hematocrit - PCV)',
        nameEn: 'Hematocrit (HCT)',
        unit: '%',
        defaultValue: '42',
        normalRange: '40 - 52 % (ذكور) / 36 - 48 % (إناث)',
        normalMin: 36,
        normalMax: 52,
      },
      {
        id: 'mcv',
        nameAr: 'متوسط حجم الكرية (MCV)',
        nameEn: 'Mean Corpuscular Volume',
        unit: 'fL',
        defaultValue: '87',
        normalRange: '80 - 100 fL',
        normalMin: 80,
        normalMax: 100,
      },
      {
        id: 'mch',
        nameAr: 'متوسط هيموجلوبين الكرية (MCH)',
        nameEn: 'Mean Corpuscular Hemoglobin',
        unit: 'pg',
        defaultValue: '29.5',
        normalRange: '27 - 33 pg',
        normalMin: 27,
        normalMax: 33,
      },
      {
        id: 'wbc',
        nameAr: 'كرات الدم البيضاء الكلية (Total Leukocyte Count)',
        nameEn: 'Total White Blood Cells (WBC)',
        unit: '×10³/µL',
        defaultValue: '6.8',
        normalRange: '4.0 - 11.0 ×10³/µL',
        normalMin: 4.0,
        normalMax: 11.0,
      },
      {
        id: 'plt',
        nameAr: 'الصفائح الدموية (Platelet Count)',
        nameEn: 'Platelets (PLT)',
        unit: '×10³/µL',
        defaultValue: '245',
        normalRange: '150 - 450 ×10³/µL',
        normalMin: 150,
        normalMax: 450,
      },
    ],
  },
  {
    id: 'thyroid',
    titleAr: 'هرمونات الغدة الدرقية',
    titleEn: 'Thyroid Hormones Profile',
    category: 'الغدد الصماء والهرمونات',
    methodology: 'Chemiluminescence Immunoassay (CLIA)',
    notesDefault: 'مستويات هرمونات الغدة الدرقية طبيعية (Euthyroid state).',
    fields: [
      {
        id: 'tsh',
        nameAr: 'الهرمون المنبه للدرقية (TSH)',
        nameEn: 'Thyroid Stimulating Hormone',
        unit: 'µIU/mL',
        defaultValue: '2.1',
        normalRange: '0.4 - 4.2 µIU/mL',
        normalMin: 0.4,
        normalMax: 4.2,
      },
      {
        id: 'ft3',
        nameAr: 'الثيروكسين الحر (Free T3)',
        nameEn: 'Free Triiodothyronine (FT3)',
        unit: 'pg/mL',
        defaultValue: '3.1',
        normalRange: '2.0 - 4.4 pg/mL',
        normalMin: 2.0,
        normalMax: 4.4,
      },
      {
        id: 'ft4',
        nameAr: 'الثيروكسين الحر (Free T4)',
        nameEn: 'Free Thyroxine (FT4)',
        unit: 'ng/dL',
        defaultValue: '1.25',
        normalRange: '0.8 - 1.8 ng/dL',
        normalMin: 0.8,
        normalMax: 1.8,
      },
    ],
  },
  {
    id: 'vitamins',
    titleAr: 'فيتامين د وفيتامين ب12',
    titleEn: 'Vitamins Profile (D3 & B12)',
    category: 'الفيتامينات والمعادن',
    methodology: 'ECLIA / CLIA Chemiluminescence',
    notesDefault: 'معدلات الفيتامينات الأساسية الحيوية.',
    fields: [
      {
        id: 'vit_d',
        nameAr: 'فيتامين د الكلي (25-OH Vitamin D)',
        nameEn: '25-Hydroxy Vitamin D',
        unit: 'ng/mL',
        defaultValue: '38',
        normalRange: '30 - 100 ng/mL (كافٍ) / 20-30 (غير كافٍ) / <20 (نقص)',
        normalMin: 30,
        normalMax: 100,
      },
      {
        id: 'vit_b12',
        nameAr: 'فيتامين ب12 (Vitamin B12)',
        nameEn: 'Cyanocobalamin (Vit B12)',
        unit: 'pg/mL',
        defaultValue: '450',
        normalRange: '200 - 900 pg/mL',
        normalMin: 200,
        normalMax: 900,
      },
      {
        id: 'ferritin',
        nameAr: 'مخزون الحديد (Serum Ferritin)',
        nameEn: 'Serum Ferritin',
        unit: 'ng/mL',
        defaultValue: '85',
        normalRange: '30 - 300 ng/mL (ذكور) / 15 - 200 ng/mL (إناث)',
        normalMin: 15,
        normalMax: 300,
      },
    ],
  },
  {
    id: 'urinalysis',
    titleAr: 'تحليل البول الكامل',
    titleEn: 'Complete Urine Analysis',
    category: 'التحاليل المجهرية',
    methodology: 'Automated Strip Reader & Microscopic High Power Field (HPF)',
    notesDefault: 'فحص مجهري وفيزيائي وكيميائي شامل.',
    fields: [
      {
        id: 'color',
        nameAr: 'اللون (Color)',
        nameEn: 'Color',
        unit: '',
        defaultValue: 'Pale Yellow (أصفر شاحب)',
        normalRange: 'Pale Yellow / Amber',
      },
      {
        id: 'aspect',
        nameAr: 'المظهر والشفافية (Aspect / Clarity)',
        nameEn: 'Aspect',
        unit: '',
        defaultValue: 'Clear (رائق)',
        normalRange: 'Clear',
      },
      {
        id: 'sp_gravity',
        nameAr: 'الكثافة النوعية (Specific Gravity)',
        nameEn: 'Specific Gravity',
        unit: '',
        defaultValue: '1.020',
        normalRange: '1.010 - 1.025',
      },
      {
        id: 'ph',
        nameAr: 'درجة الحموضة (pH)',
        nameEn: 'pH Reaction',
        unit: '',
        defaultValue: '6.0',
        normalRange: '5.0 - 7.5 (Acidic)',
      },
      {
        id: 'pus_cells',
        nameAr: 'الصديد / خلايا الدم البيضاء (Pus Cells / WBCs)',
        nameEn: 'Pus Cells (HPF)',
        unit: '/ HPF',
        defaultValue: '2 - 4',
        normalRange: '0 - 5 / HPF',
      },
      {
        id: 'rbcs',
        nameAr: 'كرات الدم الحمراء (R.B.Cs)',
        nameEn: 'R.B.Cs (HPF)',
        unit: '/ HPF',
        defaultValue: '1 - 2',
        normalRange: '0 - 3 / HPF',
      },
      {
        id: 'crystals',
        nameAr: 'الأملاح والبلورات (Crystals)',
        nameEn: 'Crystals',
        unit: '',
        defaultValue: 'Few Uric Acid Crystals',
        normalRange: 'Nil / Few',
      },
      {
        id: 'protein',
        nameAr: 'الزلال (Albumin / Protein)',
        nameEn: 'Protein',
        unit: '',
        defaultValue: 'Nil (سلبي)',
        normalRange: 'Negative / Nil',
      },
      {
        id: 'glucose',
        nameAr: 'السكر في البول (Urine Glucose)',
        nameEn: 'Glucose',
        unit: '',
        defaultValue: 'Nil (سلبي)',
        normalRange: 'Negative / Nil',
      },
    ],
  },
  {
    id: 'custom',
    titleAr: 'قالب فحص مخصص',
    titleEn: 'Custom Laboratory Investigation',
    category: 'فحوصات مخصصة',
    methodology: 'Laboratory Standard Protocol',
    notesDefault: 'تم إجراء الفحص والتحقق من النتيجة مخبرياً.',
    fields: [
      {
        id: 'param_1',
        nameAr: 'اسم التحليل / الباراميتر',
        nameEn: 'Investigation Name',
        unit: 'mg/dL',
        defaultValue: '',
        normalRange: 'المعدل المرجعي الطبيعي',
      },
    ],
  },
];
