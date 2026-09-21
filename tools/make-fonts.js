/**
 * tools/make-fonts.js
 * 
 * Zero-dependency font materializer (Pipeline 4.2a).
 * Decodes base64 text font files from fonts/src/*.b64 into fonts/*.woff2.
 * If fonts/src does not exist, reports manual placement instructions.
 * 
 * Complies with AGENTS.md Section 4.2 & Section 8.3.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'fonts', 'src');
const TARGET_DIR = path.join(ROOT, 'fonts');

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.log('[make-fonts] No fonts/src/ directory found. Using manual font placement or fallback font stack.');
    console.log('[make-fonts] See fonts/README.txt for instructions.');
    return;
  }

  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.b64'));
  if (files.length === 0) {
    console.log('[make-fonts] No .b64 font sources found in fonts/src/.');
    return;
  }

  console.log(`[make-fonts] Decoding ${files.length} base64 font files...`);
  for (const file of files) {
    const b64Content = fs.readFileSync(path.join(SRC_DIR, file), 'utf8').trim();
    const binaryBuffer = Buffer.from(b64Content, 'base64');
    const outName = file.replace(/\.b64$/, '.woff2');
    const outPath = path.join(TARGET_DIR, outName);
    fs.writeFileSync(outPath, binaryBuffer);
    console.log(`  ✓ Materialized fonts/${outName} (${binaryBuffer.length} bytes)`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
