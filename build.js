#!/usr/bin/env node
/**
 * build.js — CSS/JS 미니파이 + 파일 복사 빌드 스크립트
 * 모든 입력은 하드코딩된 파일 경로만 사용 (사용자 입력 없음)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WWW = path.join(__dirname, 'www');

// 1. 기본 디렉토리 생성
const dirs = [
  'admin', 'js/core', 'js/modes', 'js/overlays', 'js/utils', 'js/pages'
];
for (const d of dirs) {
  fs.mkdirSync(path.join(WWW, d), { recursive: true });
}

// 2. CSS 미니파이
console.log('Minifying CSS...');
for (const cssFile of ['style.css', 'nav.css']) {
  const src = path.join(__dirname, cssFile);
  const dest = path.join(WWW, cssFile);
  if (fs.existsSync(src)) {
    execFileSync('npx', ['postcss', src, '--use', 'cssnano', '--no-map', '-o', dest], { cwd: __dirname, stdio: 'pipe' });
  }
}

// 3. JS 미니파이 — app.js, site.js
console.log('Minifying JS...');
for (const jsFile of ['app.js', 'site.js']) {
  const src = path.join(__dirname, jsFile);
  const dest = path.join(WWW, jsFile);
  if (fs.existsSync(src)) {
    execFileSync('npx', ['terser', src, '-o', dest, '--compress', '--mangle'], { cwd: __dirname, stdio: 'pipe' });
  }
}

// 4. JS 모듈 미니파이 (js/ 폴더)
const jsDir = path.join(__dirname, 'js');
function minifyJsDir(dir, outDir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const srcPath = path.join(dir, entry.name);
    const destPath = path.join(outDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      minifyJsDir(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      execFileSync('npx', ['terser', srcPath, '-o', destPath, '--compress', '--mangle', '--module'], { cwd: __dirname, stdio: 'pipe' });
    }
  }
}
minifyJsDir(jsDir, path.join(WWW, 'js'));

// 5. HTML 파일 복사
console.log('Copying HTML & assets...');
const htmlFiles = ['index.html', 'frame.html', 'split.html', 'convert.html', 'exif.html', 'tools.html', 'about.html', 'featured-new.html', 'robots.txt'];
for (const f of htmlFiles) {
  const src = path.join(__dirname, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(WWW, f));
}
for (const f of ['devnote.html', 'prompt.html']) {
  const src = path.join(__dirname, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(WWW, f));
}

// 6. Admin 복사
const adminDir = path.join(__dirname, 'admin');
if (fs.existsSync(adminDir)) {
  for (const f of fs.readdirSync(adminDir)) {
    const srcPath = path.join(adminDir, f);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, path.join(WWW, 'admin', f));
    }
  }
}

// 7. 이미지 복사 (1MB 이상 파일 제외)
const imagesDir = path.join(__dirname, 'images');
if (fs.existsSync(imagesDir)) {
  for (const f of fs.readdirSync(imagesDir)) {
    const srcPath = path.join(imagesDir, f);
    const stat = fs.statSync(srcPath);
    if (stat.isFile() && stat.size < 1_000_000) {
      fs.copyFileSync(srcPath, path.join(WWW, f));
    }
  }
}

// 8. 서브 디렉토리 복사 (newexif, upscale, featured)
const cpDirs = ['newexif', 'upscale', 'featured'];
for (const d of cpDirs) {
  const src = path.join(__dirname, d);
  if (fs.existsSync(src)) {
    execFileSync('cp', ['-r', src, path.join(WWW, '/')], { stdio: 'pipe' });
  }
}

// 9. 결과 출력
console.log('\nBuild complete:');
for (const f of ['style.css', 'nav.css', 'app.js', 'site.js']) {
  const srcPath = path.join(__dirname, f);
  const destPath = path.join(WWW, f);
  if (!fs.existsSync(srcPath) || !fs.existsSync(destPath)) continue;
  const srcSize = fs.statSync(srcPath).size;
  const destSize = fs.statSync(destPath).size;
  const pct = srcSize > 0 ? Math.round((1 - destSize / srcSize) * 100) : 0;
  console.log(`  ${f}: ${(srcSize / 1024).toFixed(1)}KB -> ${(destSize / 1024).toFixed(1)}KB (-${pct}%)`);
}
