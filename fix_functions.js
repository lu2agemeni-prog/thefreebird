const fs = require('fs');

function moveFuncsUp(filePath, funcNames) {
  let c = fs.readFileSync(filePath, 'utf8');
  for (let funcName of funcNames) {
    let regex = new RegExp(`(async function ${funcName}\\([^{]*\\)\\s*\\{[\\s\\S]*?\\n\\s*\\};?)`, 'm');
    let match = c.match(regex);
    if (match) {
      let funcBody = match[0];
      c = c.replace(funcBody, '');
      
      let insertIdx = c.indexOf('useEffect(() => {');
      c = c.slice(0, insertIdx) + funcBody + '\n\n  ' + c.slice(insertIdx);
    }
  }
  fs.writeFileSync(filePath, c, 'utf8');
}

moveFuncsUp('app/queue/page.tsx', ['fetchQueue', 'fetchPresentDoctors']);
moveFuncsUp('components/dashboards/doctor/DoctorCallQueue.tsx', ['fetchQueue', 'fetchDoctorClinic']);
moveFuncsUp('components/dashboards/secretary/SecretaryCallQueue.tsx', ['fetchAll', 'fetchQueueOnly', 'fetchDoctorsOnly', 'fetchCompletedToday']);
