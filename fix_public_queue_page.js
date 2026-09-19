const fs = require('fs');
let content = fs.readFileSync('app/public/queue/page.tsx', 'utf8');

// Wait, the same error is there. The `fetchQueue` and `fetchPresentDoctors` were hoisted but caused `no-use-before-define` error because they were `const fetchQueue = async () =>`. Let's replace `const fetchQueue = async () =>` with `async function fetchQueue()` in this file!
content = content.replace(/const fetchQueue = async \(\) =>/g, 'async function fetchQueue()');
content = content.replace(/const fetchPresentDoctors = async \(\) =>/g, 'async function fetchPresentDoctors()');
fs.writeFileSync('app/public/queue/page.tsx', content);

