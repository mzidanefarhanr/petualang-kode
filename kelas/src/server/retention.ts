import type {Queryable} from '../lib/db';
import type {ObjectStorage} from '../lib/storage';
import {RETENSI_SNAPSHOT_NORMAL} from '../lib/config';

/*
 * Retensi snapshot (DATABASE.md Bagian 7).
 *
 * Memangkas snapshot biasa di atas batas per (assignment_id, student_id),
 * melindungi snapshot yang `isi_hash`-nya dirujuk submissions. Baris database
 * dihapus lebih dulu, lalu objek storage dihapus. Aman dijalankan berulang.
 */

const RETENSI_SQL = `
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

export interface RetentionResult {
    dihapus: number;
    objekGagal: number;
}

export async function runRetention(db: Queryable, storage: ObjectStorage): Promise<RetentionResult> {
    const {rows} = await db.query(RETENSI_SQL, [RETENSI_SNAPSHOT_NORMAL]);

    let objekGagal = 0;
    for (const row of rows) {
        try {
            await storage.delete(row.object_key);
        } catch {
            // Baris sudah dihapus; objek yatim dibiarkan untuk percobaan berikutnya.
            objekGagal++;
        }
    }

    return {dihapus: rows.length, objekGagal};
}
