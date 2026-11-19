import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const editorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(editorRoot, 'dist');
const vendorDir = path.join(editorRoot, 'vendor');

// Produce a plain static folder (editor/dist) that any static host can serve:
// the vendored scratch-gui bundle plus our host page.
fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});
fs.cpSync(vendorDir, outDir, {recursive: true});
fs.cpSync(path.join(editorRoot, 'public'), outDir, {recursive: true});

console.log('Build editor selesai di: ' + outDir);
