const fs = require('fs');
const glob = require('glob');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  let changed = false;

  // fix one liners: useEffect(() => { fetchResults(); }, [fetchResults]);
  const newContent = content.replace(/useEffect\(\(\) => \{ ([a-zA-Z0-9_]+)\(\); \}, \[(.*?)\]\);/g, (match, p1, p2) => {
    if (!p1.startsWith('set')) {
        changed = true;
        return `useEffect(() => { const t = setTimeout(${p1}, 0); return () => clearTimeout(t); }, [${p2}]);`;
    }
    return match;
  });
  
  if (newContent !== content) {
    fs.writeFileSync(path, newContent, 'utf8');
  }
}

const files = glob.sync('components/**/*.tsx');
files.forEach(fixFile);
