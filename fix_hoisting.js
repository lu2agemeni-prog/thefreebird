const fs = require('fs');

function fixFile(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  // Change "const fn = async () => {" to "async function fn() {"
  // This will hoist the function and fix the "accessed before declared" error
  content = content.replace(/const ([a-zA-Z0-9_]+) = async \(\) => \{/g, "async function $1() {");
  
  // Same for non-async functions: "const fn = () => {" to "function fn() {"
  // (Be careful not to break other arrows like useMemo or small callbacks, so we only target ones that look like top-level declarations in the component)
  // Actually, just targeting the specific ones is safer:
  // fetchProfile, fetchServices, fetchData, fetchAppointments, fetchPatients
  
  const fns = ['fetchProfile', 'fetchServices', 'fetchData', 'fetchAppointments', 'fetchPatients'];
  fns.forEach(fn => {
    content = content.replace(new RegExp(`const ${fn} = async \\(\\) => \\{`, 'g'), `async function ${fn}() {`);
    content = content.replace(new RegExp(`const ${fn} = useCallback\\(async \\(\\) => \\{`, 'g'), `const ${fn} = useCallback(async () => {`);
  });

  fs.writeFileSync(path, content, 'utf8');
}

[
  'components/dashboards/patient/PatientProfile.tsx',
  'components/dashboards/patient/PatientServices.tsx',
  'components/dashboards/secretary/AddQueueServiceModal.tsx',
  'components/dashboards/secretary/SecretaryAppointments.tsx',
  'components/dashboards/secretary/SecretaryPatients.tsx'
].forEach(fixFile);

