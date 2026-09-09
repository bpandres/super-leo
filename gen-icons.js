// Self-contained PNG icon generator (no external deps).
// Draws a trophy-on-confetti icon for the Super Leo PWA.
const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0;
    rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, y * rowBytes + rowBytes);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)]; }
function normAngle(a) { while (a < 0) a += Math.PI*2; while (a >= Math.PI*2) a -= Math.PI*2; return a; }
function angleInGap(a, gapStart, gapEnd) {
  // true if a (0..2PI) falls inside the (gapStart..gapEnd) wedge, which is
  // left unfilled so the handle ring reads as an open "C" attaching to the cup.
  a = normAngle(a);
  const s = normAngle(gapStart), e = normAngle(gapEnd);
  if (s <= e) return a >= s && a <= e;
  return a >= s || a <= e;
}

// A handful of fixed confetti dots (relative to icon size, 0..1) scattered
// around the trophy — colors/positions match the confetti-background
// preview the user picked.
const CONFETTI = [
  { x:0.10, y:0.10, r:0.018, c:[255,197,49] },
  { x:0.88, y:0.14, r:0.022, c:[255,93,115] },
  { x:0.86, y:0.82, r:0.018, c:[59,184,79] },
  { x:0.09, y:0.80, r:0.022, c:[255,255,255] },
  { x:0.90, y:0.52, r:0.014, c:[255,255,255] },
  { x:0.08, y:0.48, r:0.013, c:[255,197,49] },
];

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size * 0.5;
  const bgTop = [94, 201, 255];
  const bgBot = [168, 107, 255];
  const goldTop = [255, 246, 216];
  const goldBot = [201, 137, 26];
  const outline = [26, 26, 26];
  const border = 0.012; // fraction of icon size — all geometry below is in 0..1 units

  // Trophy geometry, all relative to `size` (fractions), then scaled below.
  const bowlHalfW = 0.170, bowlTopY = 0.300, bowlRectH = 0.100, bowlArcR = 0.100;
  const bowlRectBotY = bowlTopY + bowlRectH;
  const bowlArcCy = bowlRectBotY;
  const taperTopY = 0.460, taperBotY = 0.580, taperBotHW = 0.045;
  const stemTopY = 0.550, stemBotY = 0.680, stemHalfW = 0.045;
  const pedTopY = 0.655, pedBotY = 0.720, pedHalfW = 0.095;
  const baseTopY = 0.705, baseBotY = 0.750, baseHalfW = 0.155;
  const handleDX = 0.190, handleCy = 0.360, handleInR = 0.060, handleOutR = 0.115;

  function bowlMask(px, py, pad) {
    if (py >= bowlTopY - pad && py <= bowlRectBotY + pad && Math.abs(px-0.5) <= bowlHalfW + pad) return true;
    if (py >= bowlArcCy) {
      const dx = (px-0.5)/(bowlHalfW+pad), dy = (py-bowlArcCy)/(bowlArcR+pad);
      if (dx*dx+dy*dy <= 1) return true;
    }
    return false;
  }
  function taperMask(px, py, pad) {
    if (py < taperTopY-pad || py > taperBotY+pad) return false;
    const frac = Math.max(0, Math.min(1, (py-taperTopY)/(taperBotY-taperTopY)));
    const hw = lerp(bowlHalfW, taperBotHW, frac) + pad;
    return Math.abs(px-0.5) <= hw;
  }
  function rectMask(px, py, topY, botY, halfW, pad) {
    return py >= topY-pad && py <= botY+pad && Math.abs(px-0.5) <= halfW+pad;
  }
  function handleMask(px, py, side, pad) {
    const hcx = 0.5 + side*handleDX;
    const dx = px-hcx, dy = py-handleCy;
    const dist = Math.hypot(dx,dy);
    if (dist < handleInR-pad || dist > handleOutR+pad) return false;
    const ang = Math.atan2(dy,dx);
    // Gap faces inward (toward the cup) so the ring reads as an open loop.
    if (side < 0) return !angleInGap(ang, -0.9, 0.9);
    return !angleInGap(ang, Math.PI-0.9, Math.PI+0.9);
  }
  function ribbonMask(px, py, side, pad) {
    const bx = 0.5 + side*0.06, by = 0.575;
    const dx = (px-bx), dy = (py-by);
    // small downward-pointing sliver, widened slightly by pad
    return dy >= -pad && dy <= 0.05+pad && Math.abs(dx - side*dy*0.35) <= 0.018+pad;
  }
  function trophyOutline(px, py) {
    return bowlMask(px,py,border) || taperMask(px,py,border) ||
      rectMask(px,py,stemTopY,stemBotY,stemHalfW,border) ||
      rectMask(px,py,pedTopY,pedBotY,pedHalfW,border) ||
      rectMask(px,py,baseTopY,baseBotY,baseHalfW,border) ||
      handleMask(px,py,-1,border) || handleMask(px,py,1,border) ||
      ribbonMask(px,py,-1,border) || ribbonMask(px,py,1,border);
  }

  for (let y = 0; y < size; y++) {
    const py = y / size;
    for (let x = 0; x < size; x++) {
      const px = x / size;
      const i = (y * size + x) * 4;
      let col = mix(bgTop, bgBot, py);

      for (const d of CONFETTI) {
        const dx = px-d.x, dy = py-d.y;
        if (Math.hypot(dx,dy) <= d.r) col = d.c;
      }

      if (trophyOutline(px, py)) {
        col = outline;
        if (bowlMask(px,py,0)) {
          const t = Math.max(0, Math.min(1, (py-bowlTopY)/(bowlArcCy+bowlArcR-bowlTopY)));
          col = mix(goldTop, goldBot, t);
        } else if (taperMask(px,py,0)) {
          col = [201,137,26];
        } else if (rectMask(px,py,stemTopY,stemBotY,stemHalfW,0)) {
          col = [224,168,61];
        } else if (rectMask(px,py,pedTopY,pedBotY,pedHalfW,0)) {
          col = [201,137,38];
        } else if (rectMask(px,py,baseTopY,baseBotY,baseHalfW,0)) {
          col = [138,90,43];
        } else if (handleMask(px,py,-1,0) || handleMask(px,py,1,0)) {
          col = [224,168,61];
        } else if (ribbonMask(px,py,-1,0) || ribbonMask(px,py,1,0)) {
          col = [224,72,59];
        }
        // soft highlight on the bowl's upper-left
        if (bowlMask(px,py,0)) {
          const hdx = (px-0.5+0.08)/0.09, hdy = (py-0.34)/0.14;
          const hd = Math.hypot(hdx,hdy);
          if (hd < 1) col = mix(col, [255,255,255], (1-hd)*0.6);
        }
      }

      buf[i] = Math.round(Math.max(0,Math.min(255,col[0])));
      buf[i+1] = Math.round(Math.max(0,Math.min(255,col[1])));
      buf[i+2] = Math.round(Math.max(0,Math.min(255,col[2])));
      buf[i+3] = 255;
    }
  }
  return buf;
}

const sizes = [192, 512, 180];
const names = { 192: 'icon-192.png', 512: 'icon-512.png', 180: 'apple-touch-icon.png' };
for (const s of sizes) {
  const rgba = drawIcon(s);
  const png = encodePNG(s, s, rgba);
  fs.writeFileSync(__dirname + '/icons/' + names[s], png);
  console.log('wrote', names[s], png.length, 'bytes');
}
