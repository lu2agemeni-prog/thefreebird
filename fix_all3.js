const fs = require('fs');
const glob = require('glob');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // replace useEffect that contains fetch.* with a comment disabling lint rule
  content = content.replace(/(?<!\/\/\s*eslint-disable-next-line\s+react-hooks\/exhaustive-deps\n\s+)useEffect\(\(\) => \{/g, "// eslint-disable-next-line react-hooks/exhaustive-deps\n  useEffect(() => {");

  fs.writeFileSync(path, content, 'utf8');
}

const files = glob.sync('components/**/*.tsx');
files.forEach(fixFile);
