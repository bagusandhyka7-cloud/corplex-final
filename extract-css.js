const fs = require('fs');
try {
  const html = fs.readFileSync('c:/Users/171106/Downloads/corplex/extracted_template.html', 'utf8');
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
  if (styleMatches) {
      const allCss = styleMatches.map(tag => {
          const match = tag.match(/<style[^>]*>([\s\S]*?)<\/style>/);
          return match ? match[1] : '';
      }).join('\n\n/* =========================== */\n\n');
      fs.writeFileSync('c:/Users/171106/Downloads/corplex/extracted_styles.css', allCss, 'utf8');
      console.log('Successfully extracted CSS!');
  } else {
      console.log('No style tags found');
  }
} catch (e) {
  console.error(e);
}
