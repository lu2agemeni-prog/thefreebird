const fs = require('fs');

function fixFile(path, funcHeaderOriginal, funcHeaderNew, oldFuncRegexStr) {
  let c = fs.readFileSync(path, 'utf8');
  let oldFuncRegex = new RegExp(oldFuncRegexStr, 's');
  let match = c.match(oldFuncRegex);
  if (match) {
    let funcBody = match[0];
    c = c.replace(funcBody, '');
    
    // Find the state declarations and put the function right after them
    let targetStr = "const [";
    let lastStateIdx = c.lastIndexOf(targetStr);
    let insertIdx = c.indexOf('\n', lastStateIdx);
    if (insertIdx !== -1) {
       let newFuncBody = funcBody.replace(funcHeaderOriginal, funcHeaderNew);
       c = c.slice(0, insertIdx + 1) + '\n' + newFuncBody + '\n' + c.slice(insertIdx + 1);
       fs.writeFileSync(path, c, 'utf8');
    }
  }
}

// AccountantReports.tsx
let c = fs.readFileSync('components/dashboards/accountant/AccountantReports.tsx', 'utf8');
let match = c.match(/const fetchTransactions = async \(\) => \{.*?\n  \};/s);
if (match) {
  c = c.replace(match[0], '');
  let insertIdx = c.indexOf('useEffect(() => {');
  let newFuncBody = match[0].replace('const fetchTransactions = async () => {', 'async function fetchTransactions() {');
  c = c.slice(0, insertIdx) + newFuncBody + '\n\n  ' + c.slice(insertIdx);
  fs.writeFileSync('components/dashboards/accountant/AccountantReports.tsx', c, 'utf8');
}

// MedicalNewsViewer.tsx
c = fs.readFileSync('components/MedicalNewsViewer.tsx', 'utf8');
match = c.match(/async function fetchNews\(pageIndex: number\) \{.*?\n  \};/s);
if (match) {
  c = c.replace(match[0], '');
  let insertIdx = c.indexOf('useEffect(() => {');
  let newFuncBody = match[0].replace('async function fetchNews(pageIndex: number) {', 'const fetchNews = async (pageIndex: number) => {');
  c = c.slice(0, insertIdx) + newFuncBody + '\n\n  ' + c.slice(insertIdx);
  fs.writeFileSync('components/MedicalNewsViewer.tsx', c, 'utf8');
}

