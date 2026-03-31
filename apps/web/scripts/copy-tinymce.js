/**
 * Copy TinyMCE assets from node_modules to public/tinymce
 * Required for self-hosted TinyMCE in Next.js
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'tinymce');
const dest = path.join(__dirname, '..', 'public', 'tinymce');

if (!fs.existsSync(src)) {
  // Try pnpm hoisted location
  const rootSrc = path.join(__dirname, '..', '..', '..', 'node_modules', 'tinymce');
  if (fs.existsSync(rootSrc)) {
    copyDir(rootSrc, dest);
  } else {
    console.warn('TinyMCE package not found, skipping copy.');
  }
} else {
  copyDir(src, dest);
}

function copyDir(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });

  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`Copied tinymce: ${from} -> ${to}`);
}
