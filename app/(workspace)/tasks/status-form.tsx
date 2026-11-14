"use client";

import { useActionState, useState } from "react";
import { initialMutationState, statusLabels, taskStatuses, type TaskStatus } from "@/lib/task-rules";
import { updateTaskStatus } from "./actions";

export function StatusForm({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [selection, setSelection] = useState(status);
  const [state, action, pending] = useActionState(async (previous: typeof initialMutationState, form: FormData) => {
    const result = await updateTaskStatus(previous, form);
    if (!result.ok) setSelection(status);
    return result;
  }, initialMutationState);
  return <form action={action} className="mt-4 border-t border-slate-100 pt-4" aria-busy={pending}>
    <input type="hidden" name="task_id" value={taskId} />
    <label htmlFor={"status-" + taskId} className="text-sm font-medium">เปลี่ยนสถานะ</label>
    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
      <select id={"status-" + taskId} name="status" value={selection} onChange={e => setSelection(e.target.value as TaskStatus)} disabled={pending} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
        {taskStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
      </select>
      <button disabled={pending} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
    </div>
    <p role="status" className={"mt-2 break-words text-sm " + (state.ok ? "text-emerald-700" : "text-red-700")}>{state.message}</p>
  </form>;
}
