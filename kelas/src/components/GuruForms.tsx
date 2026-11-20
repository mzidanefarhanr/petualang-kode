'use client';

import {useActionState} from 'react';
import {SubmitButton} from './SubmitButton';
import {
    createAssignmentAction,
    createClassAction,
    createInviteAction,
    revokeInviteAction,
    updateAssignmentAction,
    type FormState
} from '@/app/guru/actions';

const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-sm text-slate-700';

function toDatetimeLocal(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes()
    )}`;
}

function ErrorText({state}: {state: FormState}) {
    if (!state?.error) {
        return null;
    }
    return <p className="text-sm text-red-700">{state.error}</p>;
}

export function CreateClassForm({schools}: {schools: {id: string; nama: string}[]}) {
    const [state, action] = useActionState(createClassAction, null);
    return (
        <form action={action} className="space-y-3">
            <label className="block">
                <span className={label}>Nama kelas</span>
                <input name="nama" required className={input} />
            </label>
            <label className="block">
                <span className={label}>Sekolah</span>
                <select name="school_id" className={input} defaultValue="">
                    <option value="">Tanpa sekolah</option>
                    {schools.map(school => (
                        <option key={school.id} value={school.id}>
                            {school.nama}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block">
                <span className={label}>Atau sekolah baru (opsional)</span>
                <input name="new_school" className={input} placeholder="Nama sekolah baru" />
            </label>
            <ErrorText state={state} />
            <SubmitButton>Buat kelas</SubmitButton>
        </form>
    );
}

export function CreateAssignmentForm({classId}: {classId: string}) {
    const [state, action] = useActionState(createAssignmentAction, null);
    return (
        <form action={action} className="space-y-3">
            <input type="hidden" name="class_id" value={classId} />
            <label className="block">
                <span className={label}>Judul tugas</span>
                <input name="judul" required className={input} />
            </label>
            <label className="block">
                <span className={label}>Instruksi (opsional)</span>
                <textarea name="instruksi" rows={2} className={input} />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className={label}>Dibuka pada</span>
                    <input name="dibuka_pada" type="datetime-local" required className={input} />
                </label>
                <label className="block">
                    <span className={label}>Ditutup pada</span>
                    <input name="ditutup_pada" type="datetime-local" required className={input} />
                </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input name="izinkan_terlambat" type="checkbox" defaultChecked />
                Izinkan pengumpulan terlambat
            </label>
            <ErrorText state={state} />
            <SubmitButton>Buat tugas</SubmitButton>
        </form>
    );
}

export function UpdateAssignmentForm({
    classId,
    assignmentId,
    dibukaPada,
    ditutupPada
}: {
    classId: string;
    assignmentId: string;
    dibukaPada: string;
    ditutupPada: string;
}) {
    const [state, action] = useActionState(updateAssignmentAction, null);
    return (
        <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Dibuka</span>
                <input
                    name="dibuka_pada"
                    type="datetime-local"
                    required
                    defaultValue={toDatetimeLocal(dibukaPada)}
                    className={input}
                />
            </label>
            <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Ditutup</span>
                <input
                    name="ditutup_pada"
                    type="datetime-local"
                    required
                    defaultValue={toDatetimeLocal(ditutupPada)}
                    className={input}
                />
            </label>
            <SubmitButton variant="secondary">Simpan waktu</SubmitButton>
            {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        </form>
    );
}

export function CreateInviteForm({classId}: {classId: string}) {
    const [state, action] = useActionState(createInviteAction, null);
    return (
        <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="class_id" value={classId} />
            <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Berlaku sampai</span>
                <input name="berlaku_sampai" type="datetime-local" required className={input} />
            </label>
            <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Maks pemakaian (opsional)</span>
                <input name="maks_pemakaian" type="number" min={1} className={input} />
            </label>
            <SubmitButton>Buat undangan</SubmitButton>
            {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        </form>
    );
}

export function RevokeButton({classId, inviteId}: {classId: string; inviteId: string}) {
    const [, action] = useActionState(revokeInviteAction, null);
    return (
        <form
            action={action}
            onSubmit={event => {
                if (!confirm('Cabut undangan ini? Murid yang sudah bergabung tetap aman.')) {
                    event.preventDefault();
                }
            }}
        >
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="invite_id" value={inviteId} />
            <SubmitButton variant="secondary">Cabut</SubmitButton>
        </form>
    );
}
