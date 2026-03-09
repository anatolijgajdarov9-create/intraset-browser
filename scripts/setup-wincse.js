/**
 * Pre-build script: manually downloads & extracts winCodeSign-2.6.0 into
 * the electron-builder cache so that NSIS installer creation works on
 * Windows without elevated (symlink) privileges.
 */
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execFileSync } = require('child_process');

const CACHE_DIR   = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
const FINAL_DIR   = path.join(CACHE_DIR, 'winCodeSign-2.6.0');
const DOWNLOAD_URL = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z';
const SZA_PATH    = path.join(__dirname, '..', 'node_modules', 'builder-util', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
const TMP_7Z      = path.join(CACHE_DIR, '_wincse_tmp.7z');
const TMP_OUT     = path.join(CACHE_DIR, '_wincse_tmp');

if (fs.existsSync(FINAL_DIR)) {
  console.log('[setup-wincse] Cache already exists, skipping download.');
  process.exit(0);
}

fs.mkdirSync(CACHE_DIR, { recursive: true });

console.log('[setup-wincse] Downloading winCodeSign-2.6.0.7z...');

function download(url, dest, cb, redirects = 0) {
  if (redirects > 5) return cb(new Error('Too many redirects'));
  const file = fs.createWriteStream(dest);
  https.get(url, { headers: { 'User-Agent': 'electron-builder-setup' } }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
      file.close();
      fs.unlinkSync(dest);
      return download(res.headers.location, dest, cb, redirects + 1);
    }
    if (res.statusCode !== 200) {
      file.close();
      return cb(new Error(`HTTP ${res.statusCode}`));
    }
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let received = 0;
    res.on('data', chunk => {
      received += chunk.length;
      if (total) process.stdout.write(`\r[setup-wincse]   ${(received / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`);
    });
    res.pipe(file);
    file.on('finish', () => { file.close(); process.stdout.write('\n'); cb(null); });
    file.on('error', cb);
  }).on('error', cb);
}

download(DOWNLOAD_URL, TMP_7Z, (err) => {
  if (err) { console.error('[setup-wincse] Download failed:', err.message); process.exit(1); }

  console.log('[setup-wincse] Extracting (symlink errors are OK)...');
  fs.mkdirSync(TMP_OUT, { recursive: true });

  try {
    execFileSync(SZA_PATH, ['x', '-bd', '-y', TMP_7Z, `-o${TMP_OUT}`], { stdio: 'pipe' });
  } catch (e) {
    // exit code 2 = warnings (cannot create symlinks) — files are still extracted
    if (e.status !== 2) {
      console.error('[setup-wincse] Extraction failed (code', e.status, ')');
      console.error(e.stderr?.toString() || '');
      process.exit(1);
    }
    console.log('[setup-wincse] Extraction done (2 macOS symlinks skipped — that is fine).');
  }

  // Move extracted dir to the expected cache location
  fs.renameSync(TMP_OUT, FINAL_DIR);
  fs.unlinkSync(TMP_7Z);

  console.log('[setup-wincse] winCodeSign cache ready at:', FINAL_DIR);
});
