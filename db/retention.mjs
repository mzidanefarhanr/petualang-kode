/*
 * Pekerjaan retensi snapshot berkala (DATABASE.md Bagian 7).
 *
 * Memangkas snapshot biasa di atas batas per (assignment_id, student_id),
 * melindungi snapshot yang isi_hash-nya dirujuk submissions.
 * Baris DB dihapus lebih dulu, lalu objek storage.
 * Aman dijalankan berulang.
 *
 * Jalankan: npm run db:retention   (memakai env dari .env)
 */
import {createRequire} from 'node:module';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {AwsClient} from 'aws4fetch';

const require = createRequire(import.meta.url);
const {Client} = require('pg');

const BATAS = Number(process.env.RETENSI_SNAPSHOT_NORMAL || 20);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exit(1);
}

const SQL = `
with snapshot_usang as (
  select id, object_key
  from (
    select s.id, s.object_key, s.assignment_id, s.student_id, s.isi_hash,
           row_number() over (
             partition by s.assignment_id, s.student_id
             order by s.diambil_pada desc, s.id desc
           ) as urutan
    from snapshots s
  ) x
  where x.urutan > $1
    and not exists (
      select 1
      from submissions sub
      where sub.assignment_id = x.assignment_id
        and sub.student_id = x.student_id
        and sub.isi_hash = x.isi_hash
    )
)
delete from snapshots s
using snapshot_usang u
where s.id = u.id
returning s.object_key
`;

const endpoint = process.env.S3_ENDPOINT || '';
const bucket = process.env.S3_BUCKET || '';
const driver = process.env.OBJECT_STORAGE || (process.env.S3_ACCESS_KEY_ID ? 's3' : 'local');
const localDir = process.env.OBJECT_STORAGE_DIR || join(process.cwd(), '.objects');

const s3 =
    driver === 's3'
        ? {
              client: new AwsClient({
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                  service: 's3',
                  region: process.env.S3_REGION || 'us-east-1'
              }),
              base: `${endpoint.replace(/\/$/, '')}/${bucket}`
          }
        : null;

async function hapusObjek(objectKey) {
    if (s3) {
        const response = await s3.client.fetch(`${s3.base}/${objectKey}`, {method: 'DELETE'});
        if (!response.ok && response.status !== 404) {
            throw new Error(`status ${response.status}`);
        }
        return;
    }
    await rm(join(localDir, objectKey), {force: true});
}

const client = new Client({connectionString});

try {
    await client.connect();
    const {rows} = await client.query(SQL, [BATAS]);

    let objekGagal = 0;
    for (const row of rows) {
        try {
            await hapusObjek(row.object_key);
        } catch {
            objekGagal++;
        }
    }

    console.log(`Retensi selesai: ${rows.length} baris snapshot dihapus, ${objekGagal} objek gagal dihapus.`);
} catch (error) {
    console.error('Retensi gagal:', error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
