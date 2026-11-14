"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message: string };

export async function authenticate(_state: AuthState, formData: FormData): Promise<AuthState> {
  const mode = formData.get("mode");
  const emailValue = formData.get("email");
  const password = formData.get("password");
  const nameValue = formData.get("display_name");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const displayName = typeof nameValue === "string" ? nameValue.trim() : "";
  if (mode !== "login" && mode !== "signup") return { message: "กรุณาเลือกเข้าสู่ระบบหรือสมัครสมาชิก" };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: "กรุณากรอกอีเมลให้ถูกต้อง" };
  if (typeof password !== "string" || !password) return { message: "กรุณากรอกรหัสผ่าน" };
  if (mode === "signup" && !displayName) return { message: "กรุณากรอกชื่อที่แสดง" };
  if (mode === "signup" && password.length < 6) return { message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  if (!hasSupabaseEnv) return { message: "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาตรวจ .env.local แล้วเริ่มเว็บใหม่" };

  try {
    const supabase = await createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name: displayName } },
      });
      if (error) {
        if (error.code === "user_already_exists" || error.code === "email_exists") return { message: "อีเมลนี้สมัครแล้ว กรุณาเข้าสู่ระบบ" };
        if (error.status === 429) return { message: "มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่" };
        if (error.code === "weak_password") return { message: "รหัสผ่านไม่ผ่านเงื่อนไขของระบบ กรุณาใช้รหัสผ่านที่ปลอดภัยขึ้น" };
        return { message: "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจว่าได้รัน SQL ของ US-1 และตั้งค่า Supabase แล้ว" };
      }
      if (!data.session) return { message: "ยังเข้าสู่ระบบไม่ได้ หากเป็น workshop ให้ปิด Confirm email ใน Supabase แล้วลองเข้าสู่ระบบ หรือตรวจอีเมลยืนยันบัญชี" };
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === "invalid_credentials") return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
        if (error.code === "email_not_confirmed") return { message: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ หรือตรวจการตั้งค่า Confirm email สำหรับ workshop" };
        if (error.status === 429) return { message: "มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่" };
        return { message: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
      }
    }
  } catch {
    return { message: "เชื่อมต่อระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่" };
  }
  revalidatePath("/", "layout");
  redirect("/team");
}
