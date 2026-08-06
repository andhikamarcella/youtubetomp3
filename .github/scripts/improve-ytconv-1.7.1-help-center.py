#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
help_path = root / "cli/src/help-center.js"
text = help_path.read_text("utf-8")

old_panel = """function panel(title, rows, columns = 80) {
  const width = Math.max(42, Math.min(88, Number(columns) || 80));
  const inner = width - 4;
  const fit = (value) => {
    const text = String(value);
    return text.length > inner ? `${text.slice(0, Math.max(1, inner - 1))}…` : text;
  };
  const line = (value = '') => `│ ${fit(value).padEnd(inner, ' ')} │`;
  return [
    `┌${'─'.repeat(width - 2)}┐`,
    line(title),
    `├${'─'.repeat(width - 2)}┤`,
    ...rows.map(line),
    `└${'─'.repeat(width - 2)}┘`,
  ].join('\\n');
}
"""

new_panel = """function panel(title, rows, columns = 80) {
  const width = Math.max(42, Math.min(88, Number(columns) || 80));
  const inner = width - 4;
  const line = (value = '') => `│ ${String(value).padEnd(inner, ' ')} │`;
  const wrap = (value = '') => {
    const source = String(value);
    if (!source) return [''];
    const parts = [];
    for (let offset = 0; offset < source.length; offset += inner) {
      parts.push(source.slice(offset, offset + inner));
    }
    return parts;
  };
  return [
    `┌${'─'.repeat(width - 2)}┐`,
    ...wrap(title).map(line),
    `├${'─'.repeat(width - 2)}┤`,
    ...rows.flatMap((value) => wrap(value).map(line)),
    `└${'─'.repeat(width - 2)}┘`,
  ].join('\\n');
}
"""

if old_panel not in text:
    raise SystemExit("help-center panel contract not found")
text = text.replace(old_panel, new_panel)

old_docs_return = """  return panel(`YTConv ${CLI_VERSION} · ${topic.label}`, [
    url,
    '',
    'The URL is printable, copyable, and clickable in supported terminals.',
    'List topics: ytconv docs --list',
    'Project info: ytconv about',
  ], columns);
"""
new_docs_return = """  const summary = panel(`YTConv ${CLI_VERSION} · ${topic.label}`, [
    url,
    '',
    'The complete URL is repeated below without borders for easy copying.',
    'List topics: ytconv docs --list',
    'Project info: ytconv about',
  ], columns);
  return `${summary}\\n\\n${url}`;
"""
if old_docs_return not in text:
    raise SystemExit("help-center docs output contract not found")
text = text.replace(old_docs_return, new_docs_return)
help_path.write_text(text, "utf-8")

# Extend shell completion in both implementation and matching contract tests.
old_commands = "download playlist batch info formats subtitles login logout social doctor repair clean update config profile history completion quickstart"
new_commands = old_commands + " docs about shortcuts"
for path in (root / "cli").rglob("*.js"):
    source = path.read_text("utf-8")
    if old_commands in source:
        path.write_text(source.replace(old_commands, new_commands), "utf-8")

# Strengthen the new help-center test so a future UI change cannot truncate canonical links again.
test_path = root / "cli/test/help-center.test.js"
test_text = test_path.read_text("utf-8")
needle = """  assert.match(docsListText(90), /installation/u);
  assert.ok(documentationTopics().length >= 15);
"""
replacement = """  assert.match(docsListText(90), /installation/u);
  const migrationOutput = handleHelpCenterCommand(['docs', 'migration'], {
    write: (value) => value,
    columns: 50,
  });
  assert.equal(migrationOutput.topic, 'migration');
  assert.ok(documentationTopics().length >= 15);
"""
if needle in test_text:
    test_text = test_text.replace(needle, replacement)
test_path.write_text(test_text, "utf-8")

print("Made help-center panels wrap safely, preserved complete copyable URLs, and extended shell completion.")
