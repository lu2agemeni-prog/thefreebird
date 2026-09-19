const fs = require('fs');
let content = fs.readFileSync('app/queue/page.tsx', 'utf8');

// The functions were truncated.
// I will just replace the truncated fetchQueue and fetchPresentDoctors with their full implementations.
// I'll search for `async function fetchQueue() {` and cut until `  useEffect(() => {`

let fetchQueueFull = `  const fetchQueue = async () => {
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
`;

let startIdx = content.indexOf('async function fetchQueue() {');
let endIdx = content.indexOf('  useEffect(() => {', startIdx);
let before = content.slice(0, startIdx);
let after = content.slice(endIdx);

fs.writeFileSync('app/queue/page.tsx', before + fetchQueueFull + '\n' + after);

