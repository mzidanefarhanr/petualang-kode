import {describe, expect, it} from 'vitest';
import {HASH_RE, sha256Hex, sha256HexText, snapshotKey, submissionKey} from './files';

describe('sha256', () => {
    it('sha256Hex cocok dengan vektor uji "abc"', () => {
        expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });

    it('sha256HexText cocok dengan sha256Hex untuk ASCII', () => {
        expect(sha256HexText('abc')).toBe(sha256Hex(new TextEncoder().encode('abc')));
    });

    it('HASH_RE menerima 64 hex huruf kecil saja', () => {
        expect(HASH_RE.test('a'.repeat(64))).toBe(true);
        expect(HASH_RE.test('A'.repeat(64))).toBe(false);
        expect(HASH_RE.test('a'.repeat(63))).toBe(false);
    });
});

describe('object key', () => {
    it('snapshotKey', () => {
        expect(snapshotKey('a1', 's1', 'sn1')).toBe('snapshots/a1/s1/sn1.sb3');
    });

    it('submissionKey', () => {
        expect(submissionKey('a1', 's1', 'sub1')).toBe('submissions/a1/s1/sub1.sb3');
    });
});
