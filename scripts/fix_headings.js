import fs from 'fs';

const htmlPath = './public-ui/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

let lastLevel = 1;
html = html.replace(/<h([1-6])([^>]*)>/g, (match, levelChar, rest) => {
    let level = parseInt(levelChar, 10);

    if (level > lastLevel + 1) {
        // Escalate this heading down so it's strictly one level below the last seen
        level = lastLevel + 1;
        // Inject aria-level instead of modifying the tag to preserve CSS
        if (!rest.includes('aria-level=')) {
            rest += ` aria-level="${level}"`;
        } else {
            rest = rest.replace(/aria-level="\d+"/, `aria-level="${level}"`);
        }
    }

    // Also downgrade headers if they jump backwards? No, jumping from H4 back to H2 is totally fine and standard.
    // It's only skipping "down" (e.g. H2 to H4) that is an accessibility violation.
    lastLevel = level;
    return `<h${levelChar}${rest}>`;
});

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Heading orders normalized via aria-level overrides.');
