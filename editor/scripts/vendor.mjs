/*
 * Menyiapkan bundle scratch-gui yang sudah jadi ke editor/vendor.
 *
 * Editor hanya memakai `dist/` prebuilt dari paket resmi @scratch/scratch-gui
 * (scratch-gui tetap "apa adanya", tidak dimodifikasi). Bundel di-vendor agar
 * ekosistem dependensi React-nya tidak bercampur dengan aplikasi kelas.
 *
 * Versi dikunci di VERSION. Skrip hanya menjalankan ulang bila versi berubah.
 */
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const VERSION = '15.3.0';
const editorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorDir = path.join(editorRoot, 'vendor');
const marker = path.join(vendorDir, '.version');

if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === VERSION) {
    console.log(`scratch-gui ${VERSION} sudah di-vendor.`);
    process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scratch-gui-'));
try {
    execSync(`npm pack @scratch/scratch-gui@${VERSION} --silent`, {cwd: tmp, stdio: 'ignore'});
    const tarball = fs.readdirSync(tmp).find(name => name.endsWith('.tgz'));
    if (!tarball) {
        throw new Error('Tarball scratch-gui tidak ditemukan.');
    }
    execSync(`tar -xzf "${tarball}"`, {cwd: tmp, stdio: 'ignore'});

    fs.rmSync(vendorDir, {recursive: true, force: true});
    fs.mkdirSync(vendorDir, {recursive: true});
    fs.cpSync(path.join(tmp, 'package', 'dist'), vendorDir, {recursive: true});
    fs.writeFileSync(marker, `${VERSION}\n`);

    console.log(`Vendor scratch-gui ${VERSION} siap di editor/vendor.`);
} finally {
    fs.rmSync(tmp, {recursive: true, force: true});
}
