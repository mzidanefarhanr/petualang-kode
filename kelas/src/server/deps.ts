import type {Queryable} from '../lib/db';
import type {ObjectStorage} from '../lib/storage';

/*
 * Dependensi lapisan server. Disuntikkan agar layanan dapat diuji dengan
 * database nyata maupun palsu serta penyimpanan dalam memori.
 */
export interface Deps {
    db: Queryable;
    storage: ObjectStorage;
}
