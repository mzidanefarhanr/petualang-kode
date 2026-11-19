import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const editorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(editorRoot, 'dist');
const guiDist = path.dirname(require.resolve('@scratch/scratch-gui'));

// Produce a plain static folder (editor/dist) that any static host can serve:
// the prebuilt scratch-gui bundle plus our host page.
fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});
fs.cpSync(guiDist, outDir, {recursive: true});
fs.cpSync(path.join(editorRoot, 'public'), outDir, {recursive: true});

console.log('Build editor selesai di: ' + outDir);
