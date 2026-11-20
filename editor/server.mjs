import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Our own files first; everything else falls back to the vendored scratch-gui
// bundle (editor/vendor), which is the prebuilt @scratch/scratch-gui dist.
const roots = [path.join(here, 'public'), path.join(here, 'vendor')];

const port = Number(process.env.EDITOR_PORT || 8601);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.hex': 'text/plain',
    '.map': 'application/json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.cur': 'application/octet-stream',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.eot': 'application/vnd.ms-fontobject'
};

const findFile = urlPath => {
    for (const root of roots) {
        const filePath = path.join(root, urlPath);
        if (!filePath.startsWith(root + path.sep)) continue;
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
    }
    return null;
};

http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // Konfigurasi runtime: origin aplikasi kelas untuk panggilan API lintas subdomain.
    if (urlPath === '/config.js') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        res.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store'});
        res.end('window.__SCRATCH_KELAS__ = ' + JSON.stringify({appUrl}) + ';\n');
        return;
    }

    const filePath = findFile(urlPath);
    if (!filePath) {
        res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Tidak ditemukan: ' + urlPath);
        return;
    }

    res.writeHead(200, {'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(filePath).pipe(res);
}).listen(port, () => {
    console.log('Editor Scratch berjalan di http://localhost:' + port);
});
