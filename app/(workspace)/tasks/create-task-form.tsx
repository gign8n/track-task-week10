"use client";

import { useActionState, useState } from "react";
import type { Member } from "@/lib/team";
import { initialMutationState } from "@/lib/task-rules";
import { createTask } from "./actions";

export function CreateTaskForm({ members }: { members: Member[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [state, action, pending] = useActionState(async (previous: typeof initialMutationState, form: FormData) => {
    const result = await createTask(previous, form);
    if (result.ok) { setTitle(""); setDescription(""); setDueDate(""); setAssignee(""); }
    return result;
  }, initialMutationState);
  const inputClass = "mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3";
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="create-title">
    <h2 id="create-title" className="text-xl font-bold text-blue-900">สร้างงาน</h2>
    <form action={action} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2" aria-busy={pending}>
      <label className="min-w-0 sm:col-span-2">ชื่องาน <span className="text-red-700">*</span><input name="title" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} /></label>
      <label className="min-w-0 sm:col-span-2">รายละเอียด (ไม่บังคับ)<textarea name="description" rows={3} value={description} onChange={e => setDescription(e.target.value)} className={inputClass} /></label>
      <label className="min-w-0">วันกำหนดส่ง (ไม่บังคับ)<input name="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} /></label>
      <label className="min-w-0">ผู้รับงาน <span className="text-red-700">*</span>
        <select name="assignee_id" value={assignee} onChange={e => setAssignee(e.target.value)} className={inputClass}>
          <option value="">เลือกสมาชิกในทีม</option>
          {members.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
        </select>
      </label>
      <div className="sm:col-span-2"><p role="status" className={"mb-3 break-words text-sm " + (state.ok ? "text-emerald-700" : "text-red-700")}>{state.message}</p>
        <button disabled={pending} className="w-full rounded-lg bg-blue-800 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto">{pending ? "กำลังสร้างงาน…" : "สร้างงาน"}</button>
      </div>
    </form>
  </section>;
}
