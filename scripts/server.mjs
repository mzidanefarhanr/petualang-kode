import http from 'node:http';
import {decode} from '@auth/core/jwt';
import next from 'next';
import pg from 'pg';
import {WebSocketServer} from 'ws';

if (process.argv.includes('--production')) {
    process.env.NODE_ENV = 'production';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const maxLiveStudents = Math.min(20, Math.max(1, Number(process.env.MAX_LIVE_STUDENTS ?? 20)));

const app = next({dev, hostname, port});
const handle = app.getRequestHandler();

await app.prepare();

const nextUpgradeHandler = typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    for (const part of cookieHeader.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        const v = decodeURIComponent(part.slice(idx + 1).trim());
        out[k] = v;
    }
    return out;
}

async function authenticateUpgradeRequest(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const cookieName = cookies['__Secure-sesi'] ? '__Secure-sesi' : 'sesi';
    const rawToken = cookies[cookieName];
    if (!rawToken || !process.env.AUTH_SECRET) {
        return null;
    }
    try {
        const payload = await decode({
            token: rawToken,
            secret: process.env.AUTH_SECRET,
            salt: cookieName
        });
        if (!payload?.uid || (payload.role !== 'admin' && payload.role !== 'student')) {
            return null;
        }
        return {
            id: String(payload.uid),
            role: payload.role
        };
    } catch {
        return null;
    }
}

const server = http.createServer((req, res) => {
    handle(req, res);
});

const wss = new WebSocketServer({noServer: true});

/** @type {Map<string, Set<import('ws').WebSocket & {actorId?: string; role?: string; studentId?: string; isAlive?: boolean}>>} */
const sessionRooms = new Map();

/** @type {Map<string, Set<import('ws').WebSocket & {actorId?: string; role?: string; studentId?: string; isAlive?: boolean}>>} */
const classRooms = new Map();

function getConnectedStudentsInRoom(sessionId) {
    const clients = sessionRooms.get(sessionId);
    if (!clients) return [];
    const ids = new Set();
    for (const ws of clients) {
        if (ws.readyState === ws.OPEN && ws.role === 'student' && ws.studentId) {
            ids.add(ws.studentId);
        }
    }
    return Array.from(ids);
}

function broadcastRoom(map, key, message) {
    const clients = map.get(key);
    if (!clients) return;
    const raw = JSON.stringify(message);
    for (const ws of clients) {
        if (ws.readyState === ws.OPEN) {
            ws.send(raw);
        }
    }
}

function broadcastPresence(sessionId) {
    broadcastRoom(sessionRooms, sessionId, {
        type: 'session:presence',
        payload: {
            session_id: sessionId,
            connected_student_ids: getConnectedStudentsInRoom(sessionId)
        }
    });
}

globalThis.__petualangWsHub = {
    broadcastToSession(sessionId, message) {
        broadcastRoom(sessionRooms, sessionId, message);
    },
    broadcastToClass(classId, message) {
        broadcastRoom(classRooms, classId, message);
    },
    getConnectedStudentIds(sessionId) {
        return getConnectedStudentsInRoom(sessionId);
    }
};

// Heartbeat server setiap 25 detik agar slot siswa yang terputus diam-diam segera dibebaskan
const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
        if (ws.isAlive === false) {
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        try {
            ws.ping();
        } catch {}
    }
}, 25_000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    const url = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('session_id');
    const classId = url.searchParams.get('class_id');

    const actor = await authenticateUpgradeRequest(req);

    // Koneksi ping/smoke tanpa session_id/class_id spesifik
    if (!sessionId && !classId) {
        ws.on('message', data => {
            ws.isAlive = true;
            try {
                const msg = JSON.parse(String(data));
                if (msg?.type === 'ping') {
                    ws.send(JSON.stringify({type: 'pong', payload: {server_time_ms: Date.now()}}));
                }
            } catch {}
        });
        return;
    }

    if (!actor) {
        ws.close(4001, 'BELUM_MASUK');
        return;
    }

    ws.actorId = actor.id;
    ws.role = actor.role;
    if (actor.role === 'student') {
        ws.studentId = actor.id;
    }

    let boundSessionId = null;
    let boundClassId = null;

    try {
        if (sessionId) {
            const {rows} = await pool.query(
                'select id, admin_id, class_id, maks_siswa, status from live_sessions where id = $1',
                [sessionId]
            );
            const sess = rows[0];
            if (!sess) {
                ws.close(4004, 'SESI_TIDAK_DITEMUKAN');
                return;
            }

            if (actor.role === 'admin') {
                if (sess.admin_id !== actor.id) {
                    ws.close(4003, 'TIDAK_DIIZINKAN');
                    return;
                }
            } else {
                const mem = await pool.query(
                    `select 1
                     from class_members cm
                     join students s on s.id = cm.student_id
                     where cm.class_id = $1 and cm.student_id = $2 and s.diarsipkan_pada is null`,
                    [sess.class_id, actor.id]
                );
                if (!mem.rows[0]) {
                    ws.close(4003, 'BUKAN_ANGGOTA_KELAS');
                    return;
                }

                const limit = Math.min(maxLiveStudents, Number(sess.maks_siswa || maxLiveStudents));
                const currentIds = getConnectedStudentsInRoom(sessionId);
                if (!currentIds.includes(actor.id) && currentIds.length >= limit) {
                    ws.close(4009, 'SESI_PENUH');
                    return;
                }
            }

            boundSessionId = sess.id;
            boundClassId = sess.class_id;
        } else if (classId) {
            if (actor.role === 'admin') {
                const cls = await pool.query(
                    'select id from classes where id = $1 and admin_id = $2',
                    [classId, actor.id]
                );
                if (!cls.rows[0]) {
                    ws.close(4003, 'TIDAK_DIIZINKAN');
                    return;
                }
            } else {
                const mem = await pool.query(
                    `select 1
                     from class_members cm
                     join students s on s.id = cm.student_id
                     where cm.class_id = $1 and cm.student_id = $2 and s.diarsipkan_pada is null`,
                    [classId, actor.id]
                );
                if (!mem.rows[0]) {
                    ws.close(4003, 'BUKAN_ANGGOTA_KELAS');
                    return;
                }
            }
            boundClassId = classId;
        }
    } catch {
        ws.close(4000, 'PARAMETER_TIDAK_VALID');
        return;
    }

    if (boundSessionId) {
        let sRoom = sessionRooms.get(boundSessionId);
        if (!sRoom) {
            sRoom = new Set();
            sessionRooms.set(boundSessionId, sRoom);
        }
        sRoom.add(ws);
        broadcastPresence(boundSessionId);
    }

    if (boundClassId) {
        let cRoom = classRooms.get(boundClassId);
        if (!cRoom) {
            cRoom = new Set();
            classRooms.set(boundClassId, cRoom);
        }
        cRoom.add(ws);
    }

    ws.on('message', data => {
        ws.isAlive = true;
        try {
            const msg = JSON.parse(String(data));
            if (msg?.type === 'ping') {
                ws.send(JSON.stringify({type: 'pong', payload: {server_time_ms: Date.now()}}));
            }
        } catch {}
    });

    ws.on('close', () => {
        if (boundSessionId) {
            const sRoom = sessionRooms.get(boundSessionId);
            if (sRoom) {
                sRoom.delete(ws);
                if (sRoom.size === 0) {
                    sessionRooms.delete(boundSessionId);
                }
            }
            broadcastPresence(boundSessionId);
        }
        if (boundClassId) {
            const cRoom = classRooms.get(boundClassId);
            if (cRoom) {
                cRoom.delete(ws);
                if (cRoom.size === 0) {
                    classRooms.delete(boundClassId);
                }
            }
        }
    });
});

server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, ws => {
            wss.emit('connection', ws, req);
        });
        return;
    }
    if (nextUpgradeHandler) {
        nextUpgradeHandler(req, socket, head);
    } else {
        socket.destroy();
    }
});

server.listen(port, hostname, () => {
    console.log(`Petualang Kode berjalan di http://localhost:${port} (WS: ws://localhost:${port}/ws)`);
});
