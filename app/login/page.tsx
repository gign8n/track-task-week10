import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "./auth-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/team");
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-blue-800 underline">กลับหน้าแรก</Link>
      <h1 className="mt-5 text-3xl font-bold text-blue-900">ระบบติดตามงานทีม</h1>
      <p className="mt-3 text-slate-600">เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มทำงานร่วมกับทีม</p>
      <AuthForm />
    </main>
  );
}
