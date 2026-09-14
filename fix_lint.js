const fs = require('fs');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Fix: useEffect(() => { fetchSomething(); }, []);
  // Where fetchSomething is multiple lines below
  content = content.replace(/useEffect\(\(\) => \{\n\s+([a-zA-Z0-9_]+)\(\);\n\s+\}, \[\]\);/g, "useEffect(() => {\n    const t = setTimeout($1, 0);\n    return () => clearTimeout(t);\n  }, []);");

  // Fix: useEffect(() => { setPage(0); }, [search]);
  content = content.replace(/useEffect\(\(\) => \{ (set[a-zA-Z0-9_]+\([^)]*\)); \}, (\[[^\]]*\])\);/g, "useEffect(() => { const t = setTimeout(() => $1, 0); return () => clearTimeout(t); }, $2);");

  // Fix: setResults([]) inside an effect
  content = content.replace(/setResults\(\[\]\);/g, "setTimeout(() => setResults([]), 0);");
  
  // Fix: setActiveClinic
  content = content.replace(/setActiveClinic\(([^)]+)\);/g, "setTimeout(() => setActiveClinic($1), 0);");

  fs.writeFileSync(path, content, 'utf8');
}

fixFile('components/dashboards/patient/PatientServices.tsx');
fixFile('components/dashboards/secretary/AddExistingPatientModal.tsx');
fixFile('components/dashboards/secretary/AddQueueServiceModal.tsx');
fixFile('components/dashboards/secretary/SecretaryAppointments.tsx');
// fixFile('components/dashboards/secretary/SecretaryPatients.tsx');

