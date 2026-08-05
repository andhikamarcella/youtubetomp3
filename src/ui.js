const symbols = {
  ok: '✓',
  info: '•',
  warn: '!',
  error: '×',
};

export function heading(text) {
  console.log(`\nShipForge · ${text}`);
}

export function line(kind, text) {
  console.log(`${symbols[kind] ?? symbols.info} ${text}`);
}

export function printTable(rows) {
  if (!rows.length) return;
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, String(cell).length);
    });
  }
  for (const row of rows) {
    console.log(row.map((cell, index) => String(cell).padEnd(widths[index])).join('  '));
  }
}
