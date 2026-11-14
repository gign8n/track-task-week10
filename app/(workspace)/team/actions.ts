"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readText, type MutationState } from "@/lib/task-rules";

export async function saveTeam(_state: MutationState, form: FormData): Promise<MutationState> {
  await requireUser();
  const intent = readText(form, "intent");
  if (intent !== "create" && intent !== "join") return { ok: false, message: "คำขอไม่ถูกต้อง" };
  const value = readText(form, intent === "create" ? "name" : "invite_code");
  try {
    const supabase = await createClient();
    // The database derives the caller from auth.uid(), checks membership first,
    // validates input, and creates/joins atomically. Never accept user_id or role.
    const { error } = intent === "create"
      ? await supabase.rpc("create_team", { p_name: value })
      : await supabase.rpc("join_team", { p_code: value });
    if (error) {
      const messages: Record<string, string> = {
        ALREADY_IN_TEAM: "คุณมีทีมอยู่แล้ว", TEAM_NAME_REQUIRED: "กรุณากรอกชื่อทีม",
        TEAM_NOT_FOUND: "ไม่พบทีมจากรหัสนี้", NOT_LOGGED_IN: "กรุณาเข้าสู่ระบบใหม่",
      };
      return { ok: false, message: messages[error.message] ?? "ทำรายการไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและ SQL ของ US-2 แล้วลองใหม่" };
    }
  } catch {
    return { ok: false, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/team");
  revalidatePath("/tasks");
  redirect("/team");
}
