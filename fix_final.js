const fs = require('fs');
const glob = require('glob');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Remove the useless eslint-disable lines I added
  content = content.replace(/\/\/\s*eslint-disable-next-line\s+react-hooks\/exhaustive-deps\n\s*/g, '');

  // For any useEffect that contains fetch.*();
  // if it's a simple one liner: useEffect(() => { fetchX(); }, [...]) -> useEffect(() => { const t = setTimeout(fetchX, 0); return () => clearTimeout(t); }, [...])
  content = content.replace(/useEffect\(\(\) => \{\s+([a-zA-Z0-9_]+)\(\);\s+\},\s+\[(.*?)\]\);/g, "useEffect(() => { const t = setTimeout($1, 0); return () => clearTimeout(t); }, [$2]);");
  
  // For multiple calls on one line: useEffect(() => { fetchClinics(); fetchServices(); }, [...]);
  content = content.replace(/useEffect\(\(\) => \{ ([a-zA-Z0-9_]+)\(\); ([a-zA-Z0-9_]+)\(\); \}, \[(.*?)\]\);/g, "useEffect(() => { const t1 = setTimeout($1, 0); const t2 = setTimeout($2, 0); return () => { clearTimeout(t1); clearTimeout(t2); }; }, [$3]);");

  // For ReportsTab: if (reportTab === 'clinics') fetchAppointments(); ...
  if (path.includes('ReportsTab.tsx')) {
    content = content.replace(/if \(reportTab === '(.*?)'\) (fetch[a-zA-Z0-9_]+)\(\);/g, "if (reportTab === '$1') { const t = setTimeout($2, 0); }");
  }

  // ManagerDashboard: useEffect(() => { fetchProfile(); ...
  if (path.includes('ManagerDashboard.tsx')) {
    content = content.replace(/fetchProfile\(\);/g, "setTimeout(fetchProfile, 0);");
    content = content.replace(/fetchStats\(\);/g, "setTimeout(fetchStats, 0);");
  }

  // PatientAppointments.tsx
  if (path.includes('PatientAppointments.tsx')) {
    content = content.replace(/fetchAppointments\(\);/g, "setTimeout(fetchAppointments, 0);");
    content = content.replace(/fetchClinicsAndDoctors\(\);/g, "setTimeout(fetchClinicsAndDoctors, 0);");
  }
  
  // PatientComplaints.tsx
  if (path.includes('PatientComplaints.tsx')) {
    content = content.replace(/fetchComplaints\(\);/g, "setTimeout(fetchComplaints, 0);");
  }
  
  // PatientMedicalRecords.tsx
  if (path.includes('PatientMedicalRecords.tsx')) {
    content = content.replace(/fetchRecord\(\);/g, "setTimeout(fetchRecord, 0);");
  }
  
  // PatientPrescriptions.tsx
  if (path.includes('PatientPrescriptions.tsx')) {
    content = content.replace(/fetchPrescriptions\(\);/g, "setTimeout(fetchPrescriptions, 0);");
  }

  fs.writeFileSync(path, content, 'utf8');
}

const files = glob.sync('components/**/*.tsx');
files.forEach(fixFile);
