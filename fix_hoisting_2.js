const fs = require('fs');

function fixFile(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  const fns = [
    'fetchRecord', 'fetchPrescriptions', 'fetchResults', 'fetchNews',
    'fetchConsultations', 'fetchCheckups', 'fetchTransactions',
    'fetchDoctors', 'fetchClinics', 'fetchData'
  ];

  fns.forEach(fn => {
    content = content.replace(new RegExp(`const ${fn} = async \\(\\) => \\{`, 'g'), `async function ${fn}() {`);
    content = content.replace(new RegExp(`const ${fn} = useCallback\\(async \\(\\) => \\{`, 'g'), `const ${fn} = useCallback(async () => {`);
  });

  // Fix: useEffect(() => { fetchNews(); }, [fetchNews]);
  content = content.replace(/useEffect\(\(\) => \{ ([a-zA-Z0-9_]+)\(\); \}, \[([a-zA-Z0-9_]+)\]\);/g, "useEffect(() => { const t = setTimeout($1, 0); return () => clearTimeout(t); }, [$2]);");

  fs.writeFileSync(path, content, 'utf8');
}

const glob = require('glob');
const files = glob.sync('components/**/*.tsx');
files.forEach(fixFile);

