import {createRequire} from 'node:module';

/*
 * Pembungkus CLI Next.js agar `node --env-file-if-exists=.env` memuat
 * variabel lingkungan sebelum Next.js menangkap `initialEnv`.
 */
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
process.argv = [process.execPath, nextBin, ...process.argv.slice(2)];
require(nextBin);
