const fs = require('fs');
let c = fs.readFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', 'utf8');

let replaceTarget = '  const handleCallNext = async () => {';
let insertions = `
  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const waitingList = queues.filter((q: any) => q.clinic_id === selectedClinicId && q.status === 'waiting');
  const currentCalling = queues.find((q: any) => q.clinic_id === selectedClinicId && q.status === 'calling');

  const announceAndRefresh = async (data: any) => {
    // If it's a list, find the calling one, or if it's the object itself.
    if (Array.isArray(data)) {
       const calling = data.find((q: any) => q.status === 'calling');
       if (calling) {
         playQueueAnnouncement(calling.token_number, calling.clinic?.name || 'العيادة', calling.clinic?.audio_number);
       }
    } else if (data && data.status === 'calling') {
       playQueueAnnouncement(data.token_number, selectedClinic?.name || 'العيادة', selectedClinic?.audio_number);
    }
    fetchQueueOnly();
  };

  const handleCallNext = async () => {`;

c = c.replace(replaceTarget, insertions);
fs.writeFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', c);
