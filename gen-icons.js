// Self-contained PNG icon generator (no external deps).
// Draws a soccer-ball icon on a sky-gradient background for the Super Leo PWA.
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

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const ballR = size * 0.30;
  const skyTop = [62, 160, 232];
  const skyBot = [127, 208, 245];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      let col = mix(skyTop, skyBot, t);

      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < ballR) {
        // ball shadow under it
        const shadowDy = y - (cy + ballR * 1.05);
        const shadowDx = x - cx;
        if (Math.abs(shadowDx) < ballR*0.85 && Math.abs(shadowDy) < ballR*0.18) {
          const sd = Math.sqrt((shadowDx/(ballR*0.85))**2 + (shadowDy/(ballR*0.18))**2);
          if (sd < 1) col = mix(col, [10,20,15], 0.18*(1-sd));
        }
        let ballCol = [255,255,255];
        const angle = Math.atan2(dy, dx);
        const edge = ballR * 0.93;
        if (dist > edge) {
          ballCol = [40,40,40];
        } else {
          // center pentagon
          if (dist < ballR * 0.24) {
            ballCol = [35,35,35];
          } else {
            // 5 thin seams radiating from center
            let onSeam = false;
            for (let k = 0; k < 5; k++) {
              const a = (k * (Math.PI*2/5)) - Math.PI/2;
              let diff = Math.atan2(Math.sin(angle-a), Math.cos(angle-a));
              const angWidth = 0.055 * (ballR/dist);
              if (Math.abs(diff) < angWidth && dist > ballR*0.22 && dist < ballR*0.95) onSeam = true;
            }
            ballCol = onSeam ? [35,35,35] : [245,247,249];
          }
          // soft highlight
          const hx = -0.32, hy = -0.35;
          const hdx = (dx/ballR) - hx, hdy = (dy/ballR) - hy;
          const hd = Math.sqrt(hdx*hdx*3 + hdy*hdy*3);
          if (hd < 0.35) ballCol = mix(ballCol, [255,255,255], (0.35-hd)/0.35*0.5);
        }
        col = ballCol;
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
