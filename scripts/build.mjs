import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const entryPoint = fileURLToPath(new URL('../src/patapata.ts', import.meta.url));
const distPath = fileURLToPath(new URL('../patapata.js', import.meta.url));
const minPath = fileURLToPath(new URL('../patapata.min.js', import.meta.url));

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const banner = `/*!
 * patapata.js v${pkg.version}
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 https://github.com/cosa338
 */`;

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
  entryPoints: [entryPoint],
  bundle: true,
  write: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  legalComments: 'none',
};

await build({
  ...baseConfig,
  outfile: distPath,
  minify: false,
  banner: { js: banner },
});

await build({
  ...baseConfig,
  outfile: minPath,
  minify: true,
  banner: { js: banner },
});
