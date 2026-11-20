'use server';

import {revalidatePath} from 'next/cache';
import {getPool} from '@/lib/db';
import {requireSessionRole} from '@/lib/http/auth-guard';
import {requireAccess} from '@/lib/access';
import {ApiError} from '@/lib/http/errors';
import {createSchool} from '@/server/schools';
import {createClass} from '@/server/classes';
import {createAssignment, updateAssignment} from '@/server/assignments';
import {createInvite, revokeInvite} from '@/server/invites';

export type FormState = {error?: string; ok?: boolean} | null;

const message = (error: unknown): string =>
    error instanceof ApiError ? error.pesan : 'Terjadi kesalahan. Coba lagi.';

const toDate = (value: FormDataEntryValue | null): Date | null => {
    if (typeof value !== 'string' || !value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export async function createClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
    try {
        const session = await requireSessionRole('guru');

        let schoolId = String(formData.get('school_id') ?? '') || null;
        const newSchool = String(formData.get('new_school') ?? '').trim();
        if (newSchool) {
            const school = await createSchool(getPool(), session.user.id, {nama: newSchool});
            schoolId = school.id;
        }

        await createClass(getPool(), session.user.id, {
            nama: formData.get('nama'),
            schoolId
        });

        revalidatePath('/guru');
        return {ok: true};
    } catch (error) {
        return {error: message(error)};
    }
}

export async function createAssignmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
    try {
        const session = await requireSessionRole('guru');
        const classId = String(formData.get('class_id') ?? '');
        await requireAccess(getPool(), session, {role: 'guru', classId});

        await createAssignment(getPool(), {
            classId,
            judul: formData.get('judul'),
            instruksi: formData.get('instruksi'),
            dibukaPada: toDate(formData.get('dibuka_pada')),
            ditutupPada: toDate(formData.get('ditutup_pada')),
            izinkanTerlambat: formData.get('izinkan_terlambat') === 'on'
        });

        revalidatePath(`/guru/kelas/${classId}`);
        return {ok: true};
    } catch (error) {
        return {error: message(error)};
    }
}

export async function updateAssignmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
    try {
        const session = await requireSessionRole('guru');
        const classId = String(formData.get('class_id') ?? '');
        const assignmentId = String(formData.get('assignment_id') ?? '');
        await requireAccess(getPool(), session, {role: 'guru', assignmentId});

        await updateAssignment(getPool(), assignmentId, {
            dibukaPada: toDate(formData.get('dibuka_pada')),
            ditutupPada: toDate(formData.get('ditutup_pada'))
        });

        revalidatePath(`/guru/kelas/${classId}`);
        return {ok: true};
    } catch (error) {
        return {error: message(error)};
    }
}

export async function createInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
    try {
        const session = await requireSessionRole('guru');
        const classId = String(formData.get('class_id') ?? '');
        await requireAccess(getPool(), session, {role: 'guru', classId});

        const maksRaw = String(formData.get('maks_pemakaian') ?? '').trim();
        const maks = maksRaw ? Number(maksRaw) : null;

        await createInvite(getPool(), {
            classId,
            teacherId: session.user.id,
            berlakuSampai: toDate(formData.get('berlaku_sampai')) ?? new Date(NaN),
            maksPemakaian: maks
        });

        revalidatePath(`/guru/kelas/${classId}`);
        return {ok: true};
    } catch (error) {
        return {error: message(error)};
    }
}

export async function revokeInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
    try {
        const session = await requireSessionRole('guru');
        const classId = String(formData.get('class_id') ?? '');
        const inviteId = String(formData.get('invite_id') ?? '');
        await requireAccess(getPool(), session, {role: 'guru', inviteId});

        await revokeInvite(getPool(), inviteId);
        revalidatePath(`/guru/kelas/${classId}`);
        return {ok: true};
    } catch (error) {
        return {error: message(error)};
    }
}
