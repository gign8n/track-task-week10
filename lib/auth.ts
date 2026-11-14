import { cache } from "react";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// React cache is scoped to one render request, never shared between accounts.
export const getCurrentUser = cache(async () => {
  if (!hasSupabaseEnv) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) {
    throw new Error("ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาลองใหม่");
  }
  return error ? null : data.user;
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

export const getOwnProfile = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles")
    .select("display_name").eq("user_id", user.id).single();
  if (error || !data) {
    throw new Error("ไม่สามารถอ่านชื่อผู้ใช้ได้ กรุณาตรวจว่าได้รัน SQL ของ US-1 แล้ว");
  }
  return data as { display_name: string };
});
