const fs = require('fs');
try {
  const html = fs.readFileSync('c:/Users/171106/Downloads/corplex/Corplex Platform (Standalone).html', 'utf8');
  const templateMatch = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (templateMatch) {
      const templateJson = templateMatch[1].trim();
      const templateHtml = JSON.parse(templateJson);
      fs.writeFileSync('c:/Users/171106/Downloads/corplex/extracted_template.html', templateHtml, 'utf8');
      console.log('Successfully extracted template HTML!');
  } else {
      console.log('Template not found');
  }
} catch (e) {
  console.error(e);
}
