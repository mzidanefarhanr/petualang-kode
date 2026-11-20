/*
 * Hub WebSocket per sesi live & kelas (`globalThis.__petualangWsHub`).
 */
export interface WsMessage {
    type: string;
    payload: Record<string, unknown>;
}

export interface WsHub {
    broadcastToSession: (sessionId: string, message: WsMessage) => void;
    broadcastToClass: (classId: string, message: WsMessage) => void;
    getConnectedStudentIds: (sessionId: string) => string[];
}

const globalForWs = globalThis as unknown as {__petualangWsHub?: WsHub};

export function getWsHub(): WsHub {
    if (!globalForWs.__petualangWsHub) {
        globalForWs.__petualangWsHub = {
            broadcastToSession: () => {},
            broadcastToClass: () => {},
            getConnectedStudentIds: () => []
        };
    }
    return globalForWs.__petualangWsHub;
}
