/**
 * tools/make-icons.js
 * 
 * Generates standalone PWA icons (PNG) using only built-in Node.js modules (fs, path, zlib).
 * Draws the Flange & Stud Bolt Finder icon geometrically based on icons/favicon.svg.
 * 
 * Outputs:
 *  - icons/icon-192.png (192x192)
 *  - icons/icon-512.png (512x512)
 * 
 * Usage: node tools/make-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table & function for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (13 bytes)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth: 8
  ihdr[9] = 6;  // color type: RGBA (6)
  ihdr[10] = 0; // compression method: 0 (deflate)
  ihdr[11] = 0; // filter method: 0
  ihdr[12] = 0; // interlace method: 0
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0; // Filter byte 0
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, rowOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const idatData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Render icon geometrically with 4x4 supersampling for crisp anti-aliasing
 */
function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const S = 4; // 4x4 sub-pixels
  const sampleWeight = 1 / (S * S);

  const cx = size / 2;
  const cy = size / 2;
  const rx = size * (10 / 48); // corner radius

  const rOuter = size * (17 / 48);
  const rInner = size * (7 / 48);
  const strokeHalf = (size * (2.5 / 48)) / 2;

  const boltRadius = size * (2.2 / 48);
  const boltCentersSvg = [
    [24, 10], [24, 38], [10, 24], [38, 24],
    [14, 14], [34, 34], [34, 14], [14, 34]
  ];
  const boltCenters = boltCentersSvg.map(([bx, by]) => [
    (bx / 48) * size,
    (by / 48) * size
  ]);

  // Colors
  const bgCol = [13, 17, 23, 255];       // #0d1117
  const tealCol = [54, 194, 161, 255];   // #36c2a1
  const boltCol = [109, 177, 255, 255];  // #6db1ff

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let sy = 0; sy < S; sy++) {
        const py = y + (sy + 0.5) / S;
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;

          // Check rounded box boundary
          const dxCorner = Math.max(0, Math.abs(px - cx) - (cx - rx));
          const dyCorner = Math.max(0, Math.abs(py - cy) - (cy - rx));
          const distCorner = Math.sqrt(dxCorner * dxCorner + dyCorner * dyCorner);

          if (distCorner > rx) {
            // Outside rounded rect: transparent
            continue;
          }

          let pR = bgCol[0], pG = bgCol[1], pB = bgCol[2], pA = 255;

          // Center distance
          const dCenter = Math.hypot(px - cx, py - cy);

          // Outer ring
          if (Math.abs(dCenter - rOuter) <= strokeHalf) {
            pR = tealCol[0]; pG = tealCol[1]; pB = tealCol[2];
          }

          // Inner ring
          if (Math.abs(dCenter - rInner) <= strokeHalf) {
            pR = tealCol[0]; pG = tealCol[1]; pB = tealCol[2];
          }

          // 8 Bolts
          for (let b = 0; b < boltCenters.length; b++) {
            const [bx, by] = boltCenters[b];
            const dBolt = Math.hypot(px - bx, py - by);
            if (dBolt <= boltRadius) {
              pR = boltCol[0]; pG = boltCol[1]; pB = boltCol[2];
              break;
            }
          }

          rSum += pR * sampleWeight;
          gSum += pG * sampleWeight;
          bSum += pB * sampleWeight;
          aSum += pA * sampleWeight;
        }
      }

      const pixelIdx = (y * size + x) * 4;
      rgba[pixelIdx] = Math.round(rSum);
      rgba[pixelIdx + 1] = Math.round(gSum);
      rgba[pixelIdx + 2] = Math.round(bSum);
      rgba[pixelIdx + 3] = Math.round(aSum);
    }
  }

  return encodePNG(size, size, rgba);
}

function main() {
  const iconsDir = path.resolve(__dirname, '../icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [192, 512];
  console.log('Generating PWA icons from vector geometry...');

  for (const size of sizes) {
    const pngBuffer = renderIcon(size);
    const targetPath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(targetPath, pngBuffer);
    console.log(`  ✓ Generated ${path.relative(process.cwd(), targetPath)} (${pngBuffer.length} bytes, ${size}x${size})`);
  }

  console.log('All icons created successfully.');
}

main();
