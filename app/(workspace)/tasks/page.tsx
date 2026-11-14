import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTeamContext, getTeamTasks } from "@/lib/team";
import { bangkokToday, formatDueDate, isOverdue, statusLabels, taskStatuses } from "@/lib/task-rules";
import { CreateTaskForm } from "./create-task-form";
import { StatusForm } from "./status-form";

export default async function TasksPage() {
  await requireUser();
  const context = await getTeamContext();
  if (!context) redirect("/team");
  const tasks = await getTeamTasks(context.team.id);
  const today = bangkokToday();
  const memberNames = new Map(context.members.map(member => [member.user_id, member.display_name]));
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="text-3xl font-bold text-blue-900">งานของทีม</h1><p className="mt-2 break-words text-slate-600">{context.team.name}</p></div>
      <Link href="/team" className="py-2 text-blue-800 underline">ดูสมาชิกทีม</Link>
    </div>
    {context.isOwner && <CreateTaskForm members={context.members} />}
    {tasks.length === 0 && <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">ยังไม่มีงานในทีม</p>}
    <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-3">{taskStatuses.map(status => {
      const columnTasks = tasks.filter(task => task.status === status);
      return <section key={status} aria-labelledby={"column-" + status} className="min-w-0 rounded-2xl bg-slate-100 p-3 sm:p-4">
        <h2 id={"column-" + status} className="mb-4 flex items-center justify-between gap-2 text-lg font-bold">{statusLabels[status]}<span className="rounded-full bg-white px-3 py-1 text-sm">{columnTasks.length}</span></h2>
        {columnTasks.length === 0 && <p className="py-5 text-center text-sm text-slate-500">ไม่มีงานในสถานะนี้</p>}
        <ul className="space-y-4">{columnTasks.map(task => <li key={task.id}>
          <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="break-words text-lg font-semibold">{task.title}</h3>
            {task.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{task.description}</p>}
            <p className="mt-3 break-words text-sm">ผู้รับงาน: {memberNames.get(task.assignee_id) ?? "สมาชิกทีม"}</p>
            <p className="mt-2 break-words text-sm text-slate-600">กำหนดส่ง: {formatDueDate(task.due_date)}</p>
            {isOverdue(task.due_date, task.status, today) && <p className="mt-3 inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">เลยกำหนด</p>}
            {(context.isOwner || task.assignee_id === context.userId) && <StatusForm taskId={task.id} status={task.status} />}
          </article>
        </li>)}</ul>
      </section>;
    })}</div>
    <p className="mt-6 text-sm text-slate-500">วันกำหนดส่งอ้างอิงเวลาประเทศไทย สมาชิกทีมโหลดหน้าใหม่เพื่อดูข้อมูลล่าสุดได้</p>
  </main>;
}
