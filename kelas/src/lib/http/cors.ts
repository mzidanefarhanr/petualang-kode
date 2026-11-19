/*
 * CORS eksplisit untuk origin editor (API-CONTRACTS.md Bagian 2.2).
 * Dilarang memakai wildcard "*" bersama kredensial.
 */

function allowedOrigins(): string[] {
    return [process.env.NEXT_PUBLIC_EDITOR_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
        (origin): origin is string => Boolean(origin)
    );
}

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
    const headers: Record<string, string> = {Vary: 'Origin'};

    if (requestOrigin && allowedOrigins().includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Idempotency-Key, X-CSRF-Token';
        headers['Access-Control-Max-Age'] = '86400';
    }

    return headers;
}
