const fs = require('fs');
let content = fs.readFileSync('components/dashboards/doctor/DoctorCallQueue.tsx', 'utf8');

let endStr = `  const handleCallSpecific = async (e: React.FormEvent) => {`;
let endIdx = content.indexOf(endStr);

let newTop = `'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Volume2, Users, Loader2, Hash, Lock, BellRing, CheckCircle2 } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export function DoctorCallQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [doctorClinicId, setDoctorClinicId] = useState<string | null>(null);
  const [isPresent, setIsPresent] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [callInProgress, setCallInProgress] = useState(false);
  const [specificToken, setSpecificToken] = useState('');
  const [secretaryCallSent, setSecretaryCallSent] = useState(false);

  const fetchQueue = async () => {
    setQueueLoadError(null);
    const { data, error } = await supabase
      .from('call_queue')
      .select('*')
      .eq('clinic_id', doctorClinicId)
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setQueueLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة النداء.'));
    } else {
      setQueue(data || []);
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

  useEffect(() => {
    if (user?.id) fetchDoctorClinic();
  }, [user]);

  useEffect(() => {
    if (doctorClinicId) {
      fetchQueue();
      const channel = supabase
        .channel('call_queue_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue', filter: \`clinic_id=eq.\${doctorClinicId}\` }, () => {
          fetchQueue();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [doctorClinicId]);

`;

if (endIdx !== -1) {
  let after = content.slice(endIdx);
  fs.writeFileSync('components/dashboards/doctor/DoctorCallQueue.tsx', newTop + after);
  console.log('Fixed DoctorCallQueue.tsx');
}
