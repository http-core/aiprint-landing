// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import node from '@astrojs/node';

// Диапазоны как в @fontsource: браузер скачивает только нужный сабсет.
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

/**
 * Self-host шрифтов из установленных @fontsource-пакетов (кириллица + латиница).
 * @param {string} dir каталог files/ пакета
 * @param {(subset: string) => string} file имя файла для сабсета
 * @param {{ weight: string | number, style: 'normal' | 'italic' }} props
 */
const variants = (dir, file, props) =>
  /** @type {[any, any]} */ ([
    { ...props, src: [`${dir}/${file('cyrillic')}`], unicodeRange: [CYRILLIC] },
    { ...props, src: [`${dir}/${file('latin')}`], unicodeRange: [LATIN] },
  ]);

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone', bodySizeLimit: 64 * 1024 }),
  site: process.env.SITE_URL,
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Onest',
      cssVariable: '--font-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: variants(
          './node_modules/@fontsource-variable/onest/files',
          (s) => `onest-${s}-wght-normal.woff2`,
          { weight: '100 900', style: 'normal' },
        ),
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Playfair Display',
      cssVariable: '--font-serif',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: variants(
          './node_modules/@fontsource/playfair-display/files',
          (s) => `playfair-display-${s}-400-italic.woff2`,
          { weight: 400, style: 'italic' },
        ),
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      fallbacks: ['Menlo', 'monospace'],
      options: {
        variants: variants(
          './node_modules/@fontsource-variable/jetbrains-mono/files',
          (s) => `jetbrains-mono-${s}-wght-normal.woff2`,
          { weight: '100 800', style: 'normal' },
        ),
      },
    },
  ],
});
