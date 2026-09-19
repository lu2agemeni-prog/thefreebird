const fs = require('fs');
let c = fs.readFileSync('app/queue/page.tsx', 'utf8');

// Find all indexes of 'const [dropNotice'
let i1 = c.indexOf('const [dropNotice');
let i2 = c.indexOf('const [dropNotice', i1 + 1);

if (i2 !== -1) {
  // Let's remove lines from the `// ==== ` to `const noticeTimer = ...`
  let start = c.lastIndexOf('// ==', i2);
  let end = c.indexOf(';', i2 + 100); 
  // wait, just split by lines and filter out duplicates.
  let lines = c.split('\n');
  let newLines = [];
  let seenDrop = false;
  let seenTimer = false;
  for (let line of lines) {
    if (line.includes('const [dropNotice, setDropNotice] = useState')) {
      if (seenDrop) continue;
      seenDrop = true;
    }
    if (line.includes('const noticeTimer = useRef')) {
      if (seenTimer) continue;
      seenTimer = true;
    }
    if (line.includes('// ==== إشعار النداء المنبثق ====')) {
       // just keep one
    }
    newLines.push(line);
  }
  fs.writeFileSync('app/queue/page.tsx', newLines.join('\n'));
}

let sec = fs.readFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', 'utf8');
let secIdx = sec.indexOf('await fetchQueueOnly();\n    setLoading(false);\n  };');
if (secIdx !== -1) {
  // wait, the error in sec is:
  // ./components/dashboards/secretary/SecretaryCallQueue.tsx:132:5
  // Error: await isn't allowed in non-async function
  // because `fetchAll` ends at line 124, and then there is:
  // `  const fetchQueueOnly = async () => {` ?
  // No, let's see lines 128-135 of SecretaryCallQueue.tsx
}

