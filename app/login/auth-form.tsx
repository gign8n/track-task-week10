"use client";

import { useActionState, useState } from "react";
import { authenticate } from "./actions";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [state, formAction, pending] = useActionState(authenticate, { message: "" });
  const signup = mode === "signup";
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="form-title">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={!signup} disabled={pending} onClick={() => setMode("login")} className={"rounded-lg px-3 py-3 font-semibold " + (!signup ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-700")}>เข้าสู่ระบบ</button>
        <button type="button" aria-pressed={signup} disabled={pending} onClick={() => setMode("signup")} className={"rounded-lg px-3 py-3 font-semibold " + (signup ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-700")}>สมัครสมาชิก</button>
      </div>
      <h2 id="form-title" className="mt-6 text-xl font-bold">{signup ? "สร้างบัญชีใหม่" : "ยินดีต้อนรับกลับ"}</h2>
      <form action={formAction} className="mt-5 space-y-5" aria-busy={pending}>
        <input type="hidden" name="mode" value={mode} />
        {signup && <div>
          <label htmlFor="display_name" className="mb-2 block font-medium">ชื่อที่แสดง</label>
          <input id="display_name" name="display_name" required autoComplete="nickname" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
        </div>}
        <div>
          <label htmlFor="email" className="mb-2 block font-medium">อีเมล</label>
          <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block font-medium">รหัสผ่าน</label>
          <input key={mode} id="password" name="password" type="password" required minLength={signup ? 6 : undefined} autoComplete={signup ? "new-password" : "current-password"} aria-describedby={signup ? "password-hint" : undefined} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
          {signup && <p id="password-hint" className="mt-2 text-sm text-slate-600">อย่างน้อย 6 ตัวอักษร</p>}
        </div>
        <p role="status" aria-live="polite" className="break-words text-sm text-red-700">{state.message}</p>
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white hover:bg-blue-900 disabled:opacity-60">{pending ? "กำลังดำเนินการ…" : signup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</button>
      </form>
    </section>
  );
}
