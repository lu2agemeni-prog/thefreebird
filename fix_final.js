const fs = require('fs');
let c = fs.readFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', 'utf8');

// The error is `await isn't allowed in non-async function` at line 132
// Let's see: `const fetchAll = async () => { ... }` ?
// Wait, `useEffect(() => { fetchAll(); ...`
c = c.replace('  useEffect(() => {\n    fetchAll();', '  useEffect(() => {\n    fetchAll();'); 
fs.writeFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', c);
