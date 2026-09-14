const fs = require('fs');
let c = fs.readFileSync('app/queue/page.tsx', 'utf8');
let match = c.match(/async function fetchQueue\(\) \{.*?\n  \};/s);
if (match) {
  c = c.replace(match[0], '');
  let insertIdx = c.indexOf('useEffect(() => {');
  let newFuncBody = match[0].replace('};', '}');
  c = c.slice(0, insertIdx) + newFuncBody + '\n\n  ' + c.slice(insertIdx);
  fs.writeFileSync('app/queue/page.tsx', c, 'utf8');
}
