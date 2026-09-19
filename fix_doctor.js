const fs = require('fs');
let content = fs.readFileSync('components/dashboards/doctor/DoctorCallQueue.tsx', 'utf8');

let fetchDoctorFull = `  const fetchQueue = async () => {
    setQueueLoadError(null);
    const { data, error } = await supabase
      .from('call_queue')
      .select('*')
      .eq('clinic_id', doctorClinicId)
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setQueueLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة النداء.'));
    } else if (data) {
      setQueue(data);
    }
  };

  const fetchDoctorClinic = async () => {
    setClinicLoadError(null);
    const { data, error } = await supabase.from('doctors').select('clinic_id, is_present').eq('profile_id', user?.id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        setDoctorClinicId(null);
      } else {
        setClinicLoadError(getFriendlyErrorMessage(error, 'تعذر جلب بيانات العيادة.'));
      }
    } else if (data) {
      setDoctorClinicId(data.clinic_id);
      setIsPresent(data.is_present || false);
      if (data.clinic_id) {
        const { data: clinicData } = await supabase.from('clinics').select('name, audio_number').eq('id', data.clinic_id).single();
        if (clinicData) setClinic(clinicData);
      }
    }
    setLoading(false);
  };
`;

let startIdx = content.indexOf('async function fetchQueue() {');
let endIdx = content.indexOf('  useEffect(() => {', startIdx);
let before = content.slice(0, startIdx);
let after = content.slice(endIdx);

fs.writeFileSync('components/dashboards/doctor/DoctorCallQueue.tsx', before + fetchDoctorFull + '\n' + after);
