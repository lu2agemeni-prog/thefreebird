const fs = require('fs');
let content = fs.readFileSync('app/queue/page.tsx', 'utf8');

// We need to remove the first fetchQueue and fetchPresentDoctors block
// It's between `  const [showLayoutPanel, setShowLayoutPanel] = useState(false);` and `  useEffect(() => {\n    const savedMedia`

let startPattern = `  const [showLayoutPanel, setShowLayoutPanel] = useState(false);\n\n`;
let endPattern = `  useEffect(() => {\n    const savedMedia`;

let startIdx = content.indexOf(startPattern);
let endIdx = content.indexOf(endPattern);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx + startPattern.length) + content.slice(endIdx);
  fs.writeFileSync('app/queue/page.tsx', content);
  console.log("Removed first duplicate block from app/queue/page.tsx");
}

