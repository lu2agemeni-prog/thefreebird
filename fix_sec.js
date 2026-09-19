const fs = require('fs');
let c = fs.readFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', 'utf8');
let parts = c.split('  const handleAddPatient = async');
if (parts.length === 2) {
  let newTop = `'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Plus, Loader2, Users, Volume2, CheckCircle2,
  ChevronRight, ChevronLeft, Hash, Stethoscope, ImageIcon, UserCheck, PlusCircle,
} from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddPatientModal } from './AddPatientModal';
import { AddExistingPatientModal } from './AddExistingPatientModal';
import { AddQueueServiceModal } from './AddQueueServiceModal';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export function SecretaryCallQueue() {
  const [queues, setQueues] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [addServiceForRow, setAddServiceForRow] = useState<any | null>(null);
  const [completedToday, setCompletedToday] = useState<any[]>([]);
  const [completedSearch, setCompletedSearch] = useState('');
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [specificToken, setSpecificToken] = useState('');
  const [presenceBusy, setPresenceBusy] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [secretaryAlert, setSecretaryAlert] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('secretary_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, () => fetchQueueOnly())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => fetchDoctorsOnly())
      .subscribe();

    const callChannel = supabase
      .channel('secretary-calls')
      .on('broadcast', { event: 'call_secretary' }, (payload) => {
        new Audio('/audio/ding.mp3').play().catch(() => {});
        setSecretaryAlert(\`نداء للسكرتارية - \${payload.payload?.clinicName || 'عيادة'}\`);
        setTimeout(() => setSecretaryAlert(null), 8000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (media.length < 2) return;
    const timer = setInterval(() => setMediaIndex(i => (i + 1) % media.length), 8000);
    return () => clearInterval(timer);
  }, [media.length]);

  const fetchQueueOnly = async () => {
    const { data, error } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name, audio_number), service:service_id(name, price), assigned_doctor:doctor_id(first_name, last_name)')
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل حالة النداء الآلي.'));
    } else if (data) {
      setQueues(data);
    }
    fetchCompletedToday();
  };

  const fetchCompletedToday = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name)')
      .eq('status', 'completed')
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false });
    if (data) setCompletedToday(data);
  };

  const fetchDoctorsOnly = async () => {
    const { data, error } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, is_present, profiles(first_name, last_name)');
    if (!error && data) {
      setDoctors(data);
    }
  };

  const fetchAll = async () => {
    setLoadError(null);
    const { data: clinicsData } = await supabase.from('clinics').select('*').order('name');
    if (clinicsData) {
      setClinics(clinicsData);
      if (clinicsData.length && !selectedClinicId) {
        setSelectedClinicId(clinicsData[0].id);
      }
    }
    const { data: mediaData } = await supabase.from('queue_media').select('*').eq('is_active', true).order('display_order');
    if (mediaData) setMedia(mediaData);

    await fetchDoctorsOnly();
    await fetchQueueOnly();
    setLoading(false);
  };

`;
  fs.writeFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', newTop + "  const handleAddPatient = async" + parts[1]);
  console.log("Fixed SecretaryCallQueue.tsx!");
}

