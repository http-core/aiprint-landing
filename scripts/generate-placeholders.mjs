// Генерирует заглушки портретов (один и тот же силуэт в разных «стилях»)
// и кадрирует рендер будки для карточки товара.
// Запуск: node scripts/generate-placeholders.mjs
// Финальные фото просто кладутся поверх этих файлов (или меняются пути в src/data).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = (p) => `${root}src/assets/${p}`;
const W = 900;
const H = 1200;

// Силуэт: голова, волосы, шея, плечи — общий для всех стилей («один образ»).
const HEAD = 'M450 250 C 560 250 618 340 612 470 C 606 600 540 690 450 690 C 360 690 294 600 288 470 C 282 340 340 250 450 250 Z';
const HAIR =
  'M268 500 C 236 330 330 205 462 208 C 600 212 680 320 640 520 C 626 430 596 360 536 334 C 470 380 380 372 330 352 C 296 392 280 440 268 500 Z';
const NECK = 'M398 640 L 502 640 L 516 770 L 384 770 Z';
const BODY = 'M90 1200 C 110 930 250 790 450 778 C 650 790 790 930 810 1200 Z';

// Подпись на светлой плашке — читается на любом фоне.
const label = (text) => {
  const t = `ЗАГЛУШКА · ${text.toUpperCase()}`;
  const w = 56 + t.length * 16;
  return `
  <g font-family="Menlo, monospace" font-size="22" letter-spacing="3">
    <rect x="28" y="${H - 84}" width="${w}" height="48" rx="24" fill="#faf8f3" opacity=".9"/>
    <text x="54" y="${H - 52}" fill="#141414">${t}</text>
  </g>`;
};

const figure = ({ skin, hair, body, neck = skin, extra = '' }) => `
  <path d="${BODY}" fill="${body}"/>
  <path d="${NECK}" fill="${neck}"/>
  <path d="${HEAD}" fill="${skin}"/>
  <path d="${HAIR}" fill="${hair}"/>
  ${extra}`;

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;

const styles = {
  anime: svg(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9ea"/><stop offset="1" stop-color="#b8a6ff"/></linearGradient>
      <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f78ff"/><stop offset="1" stop-color="#4b31d9"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <g fill="#fff" opacity=".85"><circle cx="150" cy="200" r="7"/><circle cx="760" cy="300" r="10"/><circle cx="700" cy="140" r="5"/><circle cx="190" cy="620" r="6"/></g>
    ${figure({ skin: '#ffe6d9', hair: 'url(#hair)', body: '#141414', neck: '#f6d3c4',
      extra: `<path d="M360 300 C 420 270 480 270 520 290" stroke="#fff" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/>
              <ellipse cx="395" cy="485" rx="30" ry="40" fill="#2b1d52"/><ellipse cx="505" cy="485" rx="30" ry="40" fill="#2b1d52"/>
              <circle cx="405" cy="472" r="10" fill="#fff"/><circle cx="515" cy="472" r="10" fill="#fff"/>
              <ellipse cx="370" cy="560" rx="26" ry="12" fill="#ff8fb1" opacity=".55"/><ellipse cx="530" cy="560" rx="26" ry="12" fill="#ff8fb1" opacity=".55"/>` })}
    ${label('Аниме')}`),

  noir: svg(`
    <defs>
      <radialGradient id="bg" cx=".62" cy=".32" r=".9"><stop offset="0" stop-color="#e9e7e2"/><stop offset=".6" stop-color="#77746e"/><stop offset="1" stop-color="#1d1c1a"/></radialGradient>
      <linearGradient id="face" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#d9d6cf"/><stop offset=".55" stop-color="#5d5a54"/><stop offset="1" stop-color="#1a1917"/></linearGradient>
      <filter id="grain"><feTurbulence baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .22"/></feComponentTransfer><feBlend in2="SourceGraphic" mode="multiply"/></filter>
    </defs>
    <g filter="url(#grain)">
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <g opacity=".22" fill="#000">${Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${120 + i * 70}" width="900" height="26"/>`).join('')}</g>
      ${figure({ skin: 'url(#face)', hair: '#0d0c0b', body: '#0d0c0b', neck: '#34322e' })}
    </g>
    ${label('Нуар')}`),

  comic: svg(`
    <defs>
      <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="14" cy="14" r="7" fill="#ff6b57"/></pattern>
    </defs>
    <rect width="100%" height="100%" fill="#ffe14d"/>
    <rect width="100%" height="100%" fill="url(#dots)" opacity=".55"/>
    <g stroke="#141414" stroke-width="10" opacity=".9">${Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return `<line x1="${450 + Math.cos(a) * 330}" y1="${470 + Math.sin(a) * 330}" x2="${450 + Math.cos(a) * 520}" y2="${470 + Math.sin(a) * 520}"/>`;
    }).join('')}</g>
    <g stroke="#141414" stroke-width="16" stroke-linejoin="round">
      ${figure({ skin: '#ffd2b8', hair: '#141414', body: '#6b4eff', neck: '#ffc3a1' })}
    </g>
    <path d="M600 210 L 820 160 L 780 300 L 860 330 L 660 330 Z" fill="#fff" stroke="#141414" stroke-width="10" stroke-linejoin="round"/>
    <text x="700" y="290" font-family="Arial Black, Arial" font-weight="900" font-size="64" text-anchor="middle" fill="#141414">ВАУ!</text>
    ${label('Комикс')}`),

  renaissance: svg(`
    <defs>
      <radialGradient id="bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#7a5a35"/><stop offset=".7" stop-color="#3a2614"/><stop offset="1" stop-color="#1c120a"/></radialGradient>
      <radialGradient id="face" cx=".42" cy=".4" r=".7"><stop offset="0" stop-color="#f2d2ae"/><stop offset="1" stop-color="#b8875c"/></radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <g filter="url(#soft)">${figure({ skin: 'url(#face)', hair: '#3b2414', body: '#5c1f1a', neck: '#d9ad83',
      extra: `<path d="M300 900 C 380 860 520 860 600 900" stroke="#c9a14a" stroke-width="10" fill="none"/>` })}</g>
    <ellipse cx="450" cy="600" rx="400" ry="560" fill="none" stroke="#c9a14a" stroke-width="18" opacity=".85"/>
    <ellipse cx="450" cy="600" rx="372" ry="532" fill="none" stroke="#e8c877" stroke-width="3" opacity=".6"/>
    ${label('Ренессанс')}`),

  cyber: svg(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a2e"/><stop offset="1" stop-color="#05040c"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <g stroke="#ff2bd6" stroke-width="2" opacity=".45">${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 75}" y1="820" x2="${450 + (i * 75 - 450) * 3}" y2="1200"/>`).join('')}${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${840 + i * i * 12}" x2="900" y2="${840 + i * i * 12}"/>`).join('')}</g>
    <circle cx="450" cy="420" r="300" fill="#ff2bd6" opacity=".12"/>
    <g transform="translate(-12 0)" opacity=".8">${figure({ skin: 'none', hair: 'none', body: 'none', neck: 'none' }).replaceAll('fill="none"', 'fill="none" stroke="#ff2bd6" stroke-width="8"')}</g>
    ${figure({ skin: '#1a1838', hair: '#0b0a1c', body: '#0b0a1c', neck: '#15132e' })}
    <g filter="url(#glow)" fill="none" stroke="#33f0ff" stroke-width="7">
      <path d="${HEAD}"/><path d="${BODY}"/>
      <rect x="350" y="450" width="200" height="56" rx="18" fill="#33f0ff" fill-opacity=".25"/>
    </g>
    ${label('Киберпанк')}`),

  watercolor: svg(`
    <defs>
      <filter id="wash"><feTurbulence baseFrequency=".012" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="60"/><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="#fbf7ee"/>
    <g filter="url(#wash)" opacity=".9">
      <circle cx="250" cy="300" r="240" fill="#c8f04a" opacity=".55"/>
      <circle cx="700" cy="420" r="260" fill="#b8a6ff" opacity=".55"/>
      <circle cx="420" cy="1000" r="380" fill="#ff9d8f" opacity=".5"/>
      ${figure({ skin: '#f5cdb4', hair: '#6b4eff', body: '#ff6b57', neck: '#efc0a3' })}
    </g>
    ${label('Акварель')}`),

  pop: svg(`
    ${[
      ['#ff6b57', '#ffe14d', '#6b4eff', '#141414'],
      ['#c8f04a', '#ff6b57', '#141414', '#6b4eff'],
      ['#6b4eff', '#c8f04a', '#ff6b57', '#141414'],
      ['#ffe14d', '#6b4eff', '#c8f04a', '#141414'],
    ]
      .map(([bg, skin, hair, body], i) => {
        const x = (i % 2) * 450;
        const y = Math.floor(i / 2) * 600;
        return `<g transform="translate(${x} ${y}) scale(.5)"><rect width="900" height="1200" fill="${bg}"/>${figure({ skin, hair, body, neck: skin })}</g>`;
      })
      .join('')}
    <rect x="0" y="1150" width="560" height="50" fill="#fff" opacity=".85"/>
    ${label('Поп-арт')}`),
};

await mkdir(out('styles'), { recursive: true });
await mkdir(out('booth'), { recursive: true });

for (const [id, s] of Object.entries(styles)) {
  await sharp(Buffer.from(s)).jpeg({ quality: 86, mozjpeg: true }).toFile(out(`styles/${id}.jpg`));
}

// Пиксель-арт: рендерим «аниме»-вариант в крошечном размере и увеличиваем без сглаживания.
const pixelBase = svg(styles.anime.replace(/<svg[^>]*>|<\/svg>/g, '').replace(/<g font-family[\s\S]*?<\/g>\s*$/, '')
  .replace('#ffd9ea', '#c8f04a').replace('#b8a6ff', '#7ccf3a'));
const tiny = await sharp(Buffer.from(pixelBase)).resize(36, 48).png().toBuffer();
const pixelLabel = Buffer.from(svg(label('Пиксель-арт')));
await sharp(tiny)
  .resize(W, H, { kernel: 'nearest' })
  .composite([{ input: pixelLabel }])
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(out('styles/pixel.jpg'));

// Рендер будки: только обрезаем поля, внешний вид не меняем.
await sharp(`${root}media/2026-11-01 20.57.59.jpg`)
  .extract({ left: 215, top: 345, width: 300, height: 560 })
  .jpeg({ quality: 92 })
  .toFile(out('booth/booth-1.jpg'));

console.log('Готово: src/assets/styles/*.jpg, src/assets/booth/booth-1.jpg');
