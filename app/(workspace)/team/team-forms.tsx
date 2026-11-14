"use client";

import { useActionState, useState } from "react";
import { initialMutationState } from "@/lib/task-rules";
import { saveTeam } from "./actions";

function TeamForm({ intent }: { intent: "create" | "join" }) {
  const [state, action, pending] = useActionState(saveTeam, initialMutationState);
  const [value, setValue] = useState("");
  const create = intent === "create";
  const id = create ? "team-name" : "invite-code";
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="text-xl font-bold text-blue-900">{create ? "สร้างทีม" : "เข้าร่วมทีม"}</h2>
    <p className="mt-2 text-sm text-slate-600">{create ? "คุณจะเป็นหัวหน้าทีมที่สร้าง" : "ขอรหัสเชิญ 6 ตัวอักษรจากเพื่อนในทีม"}</p>
    <form action={action} className="mt-5 space-y-4" aria-busy={pending}>
      <input type="hidden" name="intent" value={intent} />
      <label htmlFor={id} className="block font-medium">{create ? "ชื่อทีม" : "รหัสเชิญ"}</label>
      <input id={id} name={create ? "name" : "invite_code"} value={value} onChange={e => setValue(e.target.value)} autoComplete="off" className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-3" />
      <p role="status" className="break-words text-sm text-red-700">{state.message}</p>
      <button disabled={pending} className="w-full rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "กำลังบันทึก…" : create ? "สร้างทีม" : "เข้าร่วมทีม"}</button>
    </form>
  </section>;
}
export function TeamForms() {
  return <div className="mt-6 grid gap-5 md:grid-cols-2"><TeamForm intent="create" /><TeamForm intent="join" /></div>;
}
