import { readFile } from 'node:fs/promises';

const targets = ['../index.html', '../display.html'];

for (const rel of targets) {
  const html = await readFile(new URL(rel, import.meta.url), 'utf8');
  let checked = 0;

  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    // Syntax-only check for inline scripts. Browser globals are intentionally not executed.
    new Function(match[1]);
    checked++;
  }

  console.log(`${rel.replace('../', '')}: checked script tags: ${checked}`);
}
