import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const S = 256, C = 64, M = 256, L = 1e6, X = 65536;
const OP = { H: 0, P8: 1, P32: 2, PO: 3, DU: 4, SW: 5, OV: 6, RO: 7,
  AD: 16, SU: 17, MU: 18, DV: 19, MD: 20, D2: 21, M2: 22, NG: 23,
  AN: 24, OR: 25, XO: 26, NO: 27, SL: 28, SR: 29, RU: 30,
  EQ: 32, LT: 33, LU: 34,
  JM: 0x30, JZ: 0x31, JN: 0x32, CA: 0x33, RE: 0x34,
  LO: 0x40, ST: 0x41, PR: 0x50, PC: 0x51, IN: 0x52, EX: 0x53 };
const T = { U: 2, O: 3, D: 4, B: 5, M: 6, C: 7, R: 8, P: 9, S: 10, X: 11 };
const IM = new Uint8Array(256); IM[1]=1; IM[2]=4; IM[0x30]=IM[0x31]=IM[0x32]=IM[0x33]=2;

function r(p: Uint8Array, i: Uint8Array) {
  const n = p.length;
  const d = new Int32Array(S);
  const c = new Int32Array(C);
  const m = new Int32Array(M);
  const o = new Uint8Array(X);
  let s = 0, cs = 0, ol = 0, ip = 0, ipos = 0, st = 0;
  while (true) {
    if (st === L) return { o: o.slice(0, ol), e: T.S };
    if (ip < 0 || ip >= n) return { o: o.slice(0, ol), e: T.P };
    const op = p[ip], im = IM[op];
    if (im === undefined) return { o: o.slice(0, ol), e: T.B };
    if (ip + im >= n) return { o: o.slice(0, ol), e: T.P };
    st++;
    const nx = ip + 1 + im;
    let tk = true, a = 0, b = 0, r = 0;
    if (op === OP.H) return { o: o.slice(0, ol), e: 0 };
    if (op === OP.P8) { if (s + 1 > S) return { o: o.slice(0, ol), e: T.O }; d[s++] = (p[nx - 1] << 24) >> 24; ip = nx; continue; }
    if (op === OP.P32) { if (s + 1 > S) return { o: o.slice(0, ol), e: T.O }; d[s++] = p[nx - 4] | p[nx - 3] << 8 | p[nx - 2] << 16 | p[nx - 1] << 24; ip = nx; continue; }
    if (op === OP.PO) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; s--; ip = nx; continue; }
    if (op === OP.DU) { if (s < 1 || s + 1 > S) return { o: o.slice(0, ol), e: s < 1 ? T.U : T.O }; d[s] = d[s - 1]; s++; ip = nx; continue; }
    if (op === OP.SW) { if (s < 2) return { o: o.slice(0, ol), e: T.U }; const t = d[s - 1]; d[s - 1] = d[s - 2]; d[s - 2] = t; ip = nx; continue; }
    if (op === OP.OV) { if (s < 2 || s + 1 > S) return { o: o.slice(0, ol), e: s < 2 ? T.U : T.O }; d[s] = d[s - 2]; s++; ip = nx; continue; }
    if (op === OP.RO) { if (s < 3) return { o: o.slice(0, ol), e: T.U }; const a = d[s - 3]; d[s - 3] = d[s - 2]; d[s - 2] = d[s - 1]; d[s - 1] = a; ip = nx; continue; }
    if (op === OP.NG || op === OP.NO) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; a = d[--s]; d[s++] = op === OP.NG ? -a | 0 : ~a; ip = nx; continue; }
    if (op >= OP.AD && op <= OP.LU && op !== OP.NG && op !== OP.NO) {
      if (s < 2) return { o: o.slice(0, ol), e: T.U }; b = d[--s]; a = d[--s];
      switch (op) {
        case OP.AD: r = (a + b) | 0; break;
        case OP.SU: r = (a - b) | 0; break;
        case OP.MU: r = Math.imul(a, b); break;
        case OP.DV: if (b === 0) return { o: o.slice(0, ol), e: T.D }; r = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
        case OP.MD: if (b === 0) return { o: o.slice(0, ol), e: T.D }; r = b === -1 ? 0 : a % b | 0; break;
        case OP.D2: if (b === 0) return { o: o.slice(0, ol), e: T.D }; r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
        case OP.M2: if (b === 0) return { o: o.slice(0, ol), e: T.D }; r = ((a >>> 0) % (b >>> 0)) | 0; break;
        case OP.AN: r = a & b; break;
        case OP.OR: r = a | b; break;
        case OP.XO: r = a ^ b; break;
        case OP.SL: r = a << (b & 31); break;
        case OP.SR: r = a >> (b & 31); break;
        case OP.RU: r = (a >>> (b & 31)) | 0; break;
        case OP.EQ: r = a === b ? 1 : 0; break;
        case OP.LT: r = a < b ? 1 : 0; break;
        case OP.LU: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
      }
      d[s++] = r; ip = nx; continue;
    }
    if (op === OP.JM || op === OP.JZ || op === OP.JN) {
      const rel = ((p[nx - 2] | p[nx - 1] << 8) << 16) >> 16;
      tk = true;
      if (op !== OP.JM) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; const v = d[--s]; tk = op === OP.JZ ? v === 0 : v !== 0; }
      ip = tk ? nx + rel : nx; continue;
    }
    if (op === OP.CA) { if (cs === C) return { o: o.slice(0, ol), e: T.C }; c[cs++] = nx; ip = p[nx - 2] | p[nx - 1] << 8; continue; }
    if (op === OP.RE) { if (cs === 0) return { o: o.slice(0, ol), e: T.R }; ip = c[--cs]; continue; }
    if (op === OP.LO) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; const a = d[--s]; if (a < 0 || a >= M) return { o: o.slice(0, ol), e: T.M }; d[s++] = m[a]; ip = nx; continue; }
    if (op === OP.ST) { if (s < 2) return { o: o.slice(0, ol), e: T.U }; const a = d[--s], v = d[--s]; if (a < 0 || a >= M) return { o: o.slice(0, ol), e: T.M }; m[a] = v; ip = nx; continue; }
    if (op === OP.PR) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; const str = String(d[--s]), b = new TextEncoder().encode(str); if (ol + b.length > X) return { o: o.slice(0, ol), e: T.X }; o.set(b, ol); ol += b.length; ip = nx; continue; }
    if (op === OP.PC) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; if (ol + 1 > X) return { o: o.slice(0, ol), e: T.X }; o[ol++] = d[--s] & 255; ip = nx; continue; }
    if (op === OP.IN) { if (s >= S) return { o: o.slice(0, ol), e: T.O }; d[s++] = ipos < i.length ? i[ipos++] : -1; ip = nx; continue; }
    if (op === OP.EX) { if (s < 1) return { o: o.slice(0, ol), e: T.U }; return { o: o.slice(0, ol), e: d[--s] & 255 }; }
    return { o: o.slice(0, ol), e: T.B };
  }
}

for (const id of readdirSync(I).sort()) {
  const p = new Uint8Array(readFileSync(join(I, id, 'program.bin')));
  const inp = new Uint8Array(readFileSync(join(I, id, 'input.bin')));
  const { o, e } = r(p, inp);
  const od = join(DIR, id);
  mkdirSync(od, { recursive: true });
  writeFileSync(join(od, 'stdout.bin'), o);
  writeFileSync(join(od, 'exit.txt'), e + '\n');
}