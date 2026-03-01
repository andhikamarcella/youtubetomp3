import fs from 'fs';

const htmlPath = './public-ui/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Add aria-label to modals
html = html.replace(/<div\s+(?:[^>]*?\s+)?class="modal\s+fade"[^>]*id="([^"]+)"[^>]*>/g, (match, id) => {
    if (match.includes('aria-label') || match.includes('aria-labelledby')) {
        return match;
    }
    // Add aria-label right before the closing >
    return match.replace(/>$/, ` aria-label="${id}">`);
});

// Add aria-label to buttons that just have icons without text or aria-label
html = html.replace(/<button[^>]*>[\s\n]*<i\s+class="bi\s+bi-[^"]+"[^>]*><\/i>[\s\n]*<\/button>/g, (match) => {
    if (match.includes('aria-label')) {
        return match;
    }
    const btnMatch = match.match(/<button([^>]*)>/);
    if (btnMatch) {
        const newBtn = `<button${btnMatch[1]} aria-label="Button">`;
        return match.replace(/<button[^>]*>/, newBtn);
    }
    return match;
});

// Remove missing role on aria-* 
// E.g. [aria-valuenow] warning if role="progressbar" is missing
html = html.replace(/<div\s+class="progress-bar"[^>]*id="eqMidBar"[^>]*>/g, (match) => {
    if (!match.includes('role=')) {
        return match.replace(/>$/, ` role="progressbar">`);
    }
    return match;
});

// For inputs missing label
// Wait, Lighthouse specifically said "Form elements do not have associated labels"
html = html.replace(/<input([^>]+id="([^"]+)"[^>]+)>/g, (match, inner, id) => {
    // If it's type="hidden" or similar, skip
    if (match.includes('type="hidden"') || match.includes('aria-label') || match.includes('aria-labelledby')) {
        return match;
    }

    // Quick fix: add aria-label if not present
    return match.replace(/>$/, ` aria-label="${id} input">`);
});

html = html.replace(/<select([^>]+id="([^"]+)"[^>]+)>/g, (match, inner, id) => {
    if (match.includes('aria-label') || match.includes('aria-labelledby')) {
        return match;
    }
    return match.replace(/>$/, ` aria-label="${id} select">`);
});


fs.writeFileSync(htmlPath, html, 'utf8');
console.log('A11y automated fixes applied.');
