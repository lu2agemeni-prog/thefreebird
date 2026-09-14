const fs = require('fs');

function fix(path, from, to) {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(from, to);
  fs.writeFileSync(path, c, 'utf8');
}

fix('components/dashboards/doctor/DoctorPrescriptions.tsx', /setSearchResults\(\[\]\);/g, "setTimeout(() => setSearchResults([]), 0);");
fix('components/dashboards/doctor/DoctorProfile.tsx', /setFirstName\(user\.first_name \|\| ''\);/, "setTimeout(() => setFirstName(user.first_name || ''), 0);");
fix('components/dashboards/doctor/DoctorProfile.tsx', /setLastName\(user\.last_name \|\| ''\);/, "setTimeout(() => setLastName(user.last_name || ''), 0);");
fix('components/dashboards/doctor/DoctorProfile.tsx', /setPhone\(user\.phone \|\| ''\);/, "setTimeout(() => setPhone(user.phone || ''), 0);");
