const fs = require('fs');
let content = fs.readFileSync('app/queue/page.tsx', 'utf8');

// The corrupted block starts after `  }, [zoom]);`
// Wait, let's just find `  useEffect(() => {\n    soundEnabledRef.current = soundEnabled;\n  }, [soundEnabled]);` and what follows.

let startStr = `  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);`;

let endStr = `  const handleMouseMove = useCallback((e: React.MouseEvent) => {`;

let startIdx = content.indexOf('  useEffect(() => {\n    soundEnabledRef.current = soundEnabled;');
if (startIdx === -1) {
  startIdx = content.indexOf('  const enableSound = () => {');
  // wait, earlier we saw `return () => document.removeEventListener('fullscreenchange', onFsChange);\n  }, []);\n          setDropNotice(`
  startIdx = content.indexOf("return () => document.removeEventListener('fullscreenchange', onFsChange);\n  }, []);") + 82;
}

let endIdx = content.indexOf(endStr);
if (endIdx !== -1 && startIdx !== -1) {
  let before = content.slice(0, startIdx);
  let after = content.slice(endIdx);
  let replacement = `
  // ==== إشعار النداء المنبثق ====
  const [dropNotice, setDropNotice] = useState<{ token: number; clinicName: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const enableSound = () => {
    const unlock = new Audio('/audio/ding.mp3');
    unlock.volume = 0;
    unlock.play().catch(() => {});
    setSoundEnabled(true);
  };

  const fetchQueue = async () => {
    const { data } = await supabase.rpc('get_public_queue_status');
    if (data) {
      setQueue(data);
      const calling = data.find((q: any) => q.status === 'calling');
      if (calling && calling.id !== lastAnnouncedIdRef.current) {
        lastAnnouncedIdRef.current = calling.id;
        if (soundEnabledRef.current) {
          playQueueAnnouncement(calling.token_number, calling.clinic_name || '', calling.clinic_audio_number);
        }
        setDropNotice({ token: calling.token_number, clinicName: calling.clinic_name || 'العيادة' });
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setDropNotice(null), 10000);
      }
    }
  };

  const fetchPresentDoctors = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, is_present, profiles(first_name, last_name), clinics(name)')
      .eq('is_present', true);
    if (data) setPresentDoctors(data);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchQueue();
    fetchPresentDoctors();

    const sub = supabase.channel('queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();

    const presenceSub = supabase.channel('doctor_presence_changes_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, fetchPresentDoctors)
      .subscribe();

    const pollTimer = setInterval(fetchQueue, 5000);
    const presencePoll = setInterval(fetchPresentDoctors, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
      clearInterval(presencePoll);
      supabase.removeChannel(sub);
      supabase.removeChannel(presenceSub);
    };
  }, []);

  useEffect(() => {
    if (!modeHasMedia(viewMode)) return;
    supabase.from('queue_media').select('*').eq('is_active', true).order('display_order', { ascending: true })
      .then(({ data }) => setMedia(data || []));
  }, [viewMode]);

  useEffect(() => {
    if (media.length === 0) return;
    const t = setInterval(() => setMediaIndex(i => (i + 1) % media.length), 8000);
    return () => clearInterval(t);
  }, [media]);

`;
  fs.writeFileSync('app/queue/page.tsx', before + replacement + after);
  console.log("Replaced block in app/queue/page.tsx");
} else {
  console.log("Could not find block in app/queue/page.tsx");
}
