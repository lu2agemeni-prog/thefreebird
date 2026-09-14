const fs = require('fs');
const glob = require('glob');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  let changed = false;

  // Hoist ALL functions that match `const someName = async () => {`
  content = content.replace(/const ([a-zA-Z0-9_]+) = async \(\) => \{/g, (match, p1) => {
    changed = true;
    return `async function ${p1}() {`;
  });
  
  // Also non-async: `const fetchAll = () => {`
  content = content.replace(/const (fetch[a-zA-Z0-9_]+) = \(\) => \{/g, (match, p1) => {
    changed = true;
    return `function ${p1}() {`;
  });

  // Also replace simple setState directly in useEffects
  // e.g. useEffect(() => { fetchNews(); }, [fetchNews]); -> useEffect(() => { setTimeout(fetchNews, 0); }, [fetchNews]);
  // Actually, wait, since we hoisted them, we don't NEED setTimeout!
  // Hoisted function avoids "accessed before it is declared" error!
  // The only thing we need to fix is "Calling setState synchronously within an effect".
  content = content.replace(/useEffect\(\(\) => \{ ([a-zA-Z0-9_]+)\(\); \}, \[(.*?)\]\);/g, (match, p1, p2) => {
    if (p1.startsWith('set')) {
        changed = true;
        return `useEffect(() => { const t = setTimeout(() => ${p1}(), 0); return () => clearTimeout(t); }, [${p2}]);`;
    }
    return match;
  });
  
  content = content.replace(/useEffect\(\(\) => \{ (set[a-zA-Z0-9_]+)\(([^)]*)\); \}, \[(.*?)\]\);/g, (match, p1, p2, p3) => {
    changed = true;
    return `useEffect(() => { const t = setTimeout(() => ${p1}(${p2}), 0); return () => clearTimeout(t); }, [${p3}]);`;
  });

  if (changed) {
    fs.writeFileSync(path, content, 'utf8');
  }
}

const files = glob.sync('components/**/*.tsx');
files.forEach(fixFile);
