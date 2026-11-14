"use client";

import { useActionState } from "react";
import { signOut } from "@/app/sign-out-action";

export function SignOut() {
  const [state, action, pending] = useActionState(signOut, { message: "" });
  return <form action={action} className="shrink-0">
    <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60">{pending ? "กำลังออก…" : "ออกจากระบบ"}</button>
    {state.message && <p role="alert" className="mt-2 max-w-56 text-sm text-red-700">{state.message}</p>}
  </form>;
}
