const fs = require('fs');

function fix(path, from, to) {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(from, to);
  fs.writeFileSync(path, c, 'utf8');
}

fix('components/dashboards/manager/DoctorDetail.tsx', /fetchReports\(\);/g, "setTimeout(fetchReports, 0);");
fix('components/dashboards/manager/tabs/AdditionalAccountsTab.tsx', /fetchRows\(\);/g, "setTimeout(fetchRows, 0);");
fix('components/dashboards/manager/tabs/BroadcastNotificationsTab.tsx', /setUserResults\(\[\]\);/g, "setTimeout(() => setUserResults([]), 0);");
