"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function signOut(): Promise<{ message: string }> {
  await requireUser();
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { message: "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" };
  } catch {
    return { message: "เชื่อมต่อระบบไม่ได้ กรุณาลองออกจากระบบอีกครั้ง" };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
