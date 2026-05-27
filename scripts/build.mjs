import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const entryPoint = fileURLToPath(new URL('../src/patapata.ts', import.meta.url));
const distPath = fileURLToPath(new URL('../patapata.js', import.meta.url));
const minPath = fileURLToPath(new URL('../patapata.min.js', import.meta.url));

const banner = `/*!
 * patapata.jp v0.1.1
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
