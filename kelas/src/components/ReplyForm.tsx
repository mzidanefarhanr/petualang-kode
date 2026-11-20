import {replyCommentAction} from '@/app/actions';
import {SubmitButton} from './SubmitButton';

export function ReplyForm({submissionId, path}: {submissionId: string; path: string}) {
    return (
        <form action={replyCommentAction} className="space-y-2">
            <input type="hidden" name="submission_id" value={submissionId} />
            <input type="hidden" name="path" value={path} />
            <textarea
                name="isi"
                required
                maxLength={2000}
                rows={3}
                placeholder="Tulis komentar..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <SubmitButton variant="secondary">Kirim komentar</SubmitButton>
        </form>
    );
}
