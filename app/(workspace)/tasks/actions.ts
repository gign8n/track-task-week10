"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getTeamContext } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
import { isTaskStatus, isUuid, isValidDate, readText, type MutationState } from "@/lib/task-rules";

export async function createTask(_state: MutationState, form: FormData): Promise<MutationState> {
  const user = await requireUser();
  const title = readText(form, "title");
  const description = readText(form, "description");
  const dueDate = readText(form, "due_date");
  const assigneeId = readText(form, "assignee_id");
  if (!title) return { ok: false, message: "กรุณากรอกชื่องาน" };
  if (!isUuid(assigneeId)) return { ok: false, message: "กรุณาเลือกผู้รับงานจากสมาชิกในทีม" };
  if (dueDate && !isValidDate(dueDate)) return { ok: false, message: "กรุณากรอกวันกำหนดส่งให้ถูกต้อง" };
  try {
    const context = await getTeamContext();
    if (!context) return { ok: false, message: "กรุณาสร้างหรือเข้าร่วมทีมก่อน" };
    if (!context.isOwner) return { ok: false, message: "เฉพาะหัวหน้าทีมเท่านั้นที่สร้างงานได้" };
    if (!context.members.some(member => member.user_id === assigneeId)) return { ok: false, message: "มอบหมายงานได้เฉพาะสมาชิกในทีม" };
    const supabase = await createClient();
    const { data, error } = await supabase.from("tasks").insert({
      team_id: context.team.id, title, description: description || null,
      due_date: dueDate || null, assignee_id: assigneeId, created_by: user.id, status: "todo",
    }).select("id").single();
    if (error || !data) return { ok: false, message: error?.code === "23503" ? "มอบหมายงานได้เฉพาะสมาชิกในทีม" : "สร้างงานไม่สำเร็จ กรุณาตรวจสิทธิ์และลองใหม่" };
  } catch {
    return { ok: false, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/tasks");
  return { ok: true, message: "สร้างงานสำเร็จ" };
}

export async function updateTaskStatus(_state: MutationState, form: FormData): Promise<MutationState> {
  const user = await requireUser();
  if (["title", "description", "due_date", "assignee_id", "team_id", "created_by", "created_at", "updated_at", "id"].some(field => form.has(field))) {
    return { ok: false, message: "คุณแก้ได้เฉพาะสถานะของงานนี้" };
  }
  const taskId = readText(form, "task_id");
  const status = readText(form, "status");
  if (!isUuid(taskId) || !isTaskStatus(status)) return { ok: false, message: "ข้อมูลงานหรือสถานะไม่ถูกต้อง" };
  try {
    const context = await getTeamContext();
    if (!context) return { ok: false, message: "กรุณาสร้างหรือเข้าร่วมทีมก่อน" };
    const supabase = await createClient();
    const { data: task, error: readError } = await supabase.from("tasks")
      .select("id, assignee_id").eq("id", taskId).eq("team_id", context.team.id).maybeSingle();
    if (readError || !task || (!context.isOwner && task.assignee_id !== user.id)) return { ok: false, message: "คุณไม่มีสิทธิ์เปลี่ยนสถานะงานนี้ หรือไม่พบงาน" };
    // Only status is ever forwarded. DB trigger also protects direct API updates.
    const { data, error } = await supabase.from("tasks").update({ status })
      .eq("id", taskId).eq("team_id", context.team.id).select("id").maybeSingle();
    if (error || !data) return { ok: false, message: "บันทึกสถานะไม่สำเร็จ กรุณาตรวจสิทธิ์และลองใหม่" };
  } catch {
    return { ok: false, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/tasks");
  return { ok: true, message: "บันทึกสถานะแล้ว" };
}
