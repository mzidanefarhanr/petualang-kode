import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireSessionActor} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {getMediaContentForActor} from '@/server/media';

export async function GET(
    _request: Request,
    context: {params: Promise<{asset_id: string}>}
) {
    try {
        const actor = requireSessionActor(await auth());
        const {asset_id} = await context.params;
        const content = await getMediaContentForActor(getPool(), actor, asset_id);
        const ab = content.bytes.buffer.slice(
            content.bytes.byteOffset,
            content.bytes.byteOffset + content.bytes.byteLength
        ) as ArrayBuffer;

        return new NextResponse(ab, {
            status: 200,
            headers: {
                'Content-Type': content.mime_type,
                'Content-Length': String(content.bytes.byteLength),
                'Cache-Control': 'private, max-age=3600',
                'X-Content-Type-Options': 'nosniff'
            }
        });
    } catch (error) {
        return errorResponse(error);
    }
}
