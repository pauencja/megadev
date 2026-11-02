import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { lane } from '../src/lane.js';

// Saves /digest/<night> as one HTML file, banner included. Usage: pnpm preview [night] [out]
const night = process.argv[2] ?? '2026-10-28';
const out = process.argv[3] ?? 'var/preview.html';

const res = await createApp().request(`/digest/${night}`);
if (res.status !== 200) throw new Error(`/digest/${night} answered ${res.status}`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved ${out} · marker: ${lane().marker ?? 'no marker set'}`);
