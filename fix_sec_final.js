const fs = require('fs');
let c = fs.readFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', 'utf8');

// I need to remove the floating block starting at `      setClinics(clinicsRes.data || []);` and ending at `fetchCompletedToday();\n  };`
// Let's find it using regex or just indexof.
let orphanStart = c.indexOf('      setClinics(clinicsRes.data || []);');
if (orphanStart !== -1) {
  let orphanEnd = c.indexOf('    fetchCompletedToday();\n  };', orphanStart);
  if (orphanEnd !== -1) {
    c = c.slice(0, orphanStart) + c.slice(orphanEnd + 33);
    fs.writeFileSync('components/dashboards/secretary/SecretaryCallQueue.tsx', c);
    console.log("Removed orphan block from SecretaryCallQueue.tsx");
  }
}
