import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTeamContext } from "@/lib/team";
import { TeamForms } from "./team-forms";

export default async function TeamPage() {
  await requireUser();
  const context = await getTeamContext();
  return <main className="mx-auto w-full max-w-4xl px-4 py-10">
    <h1 className="text-3xl font-bold text-blue-900">ทีมของฉัน</h1>
    {!context ? <><p className="mt-3 text-slate-600">คุณยังไม่มีทีม เลือกสร้างทีมใหม่หรือเข้าร่วมทีมของเพื่อน</p><TeamForms /></> : <>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="break-words text-2xl font-bold">{context.team.name}</h2>
        <p className="mt-4 text-sm text-slate-600">รหัสเชิญสำหรับชวนเพื่อนเข้าทีม</p>
        <p className="mt-1 inline-block rounded-lg bg-blue-50 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-blue-900">{context.team.invite_code}</p>
        <p className="mt-3 text-sm text-slate-600">สมาชิกทุกคนเห็นรหัสนี้และชวนเพื่อนเข้าทีมได้</p>
        <Link href="/tasks" className="mt-5 inline-block rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white">ดูงานของทีม</Link>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">สมาชิก {context.members.length} คน</h2>
        <ul className="mt-4 divide-y divide-slate-100">{context.members.map(member => <li key={member.user_id} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-4">
          <div className="min-w-0"><p className="break-words font-semibold">{member.display_name}{member.user_id === context.userId ? " (คุณ)" : ""}</p><p className="break-all text-sm text-slate-600">{member.email}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{member.user_id === context.team.owner_id ? "หัวหน้า" : "สมาชิก"}</span>
        </li>)}</ul>
      </section>
    </>}
  </main>;
}
