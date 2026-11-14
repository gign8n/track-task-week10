import Link from "next/link";
import { getCurrentUser, getOwnProfile } from "@/lib/auth";
import { SignOut } from "./sign-out";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getOwnProfile() : null;
  return <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link href={user ? "/team" : "/"} className="font-bold text-blue-900">ระบบติดตามงานทีม</Link>
      {profile && <nav aria-label="เมนูหลัก" className="flex gap-4 text-sm font-medium text-blue-800"><Link href="/team" className="py-2 underline">ทีมของฉัน</Link><Link href="/tasks" className="py-2 underline">งานของทีม</Link></nav>}
      {profile ? <div className="flex min-w-0 max-w-full items-center gap-3">
        <span className="min-w-0 break-words text-sm">{profile.display_name}</span><SignOut />
      </div> : <Link href="/login" className="text-blue-800 underline">เข้าสู่ระบบ / สมัครสมาชิก</Link>}
    </div>
  </header>;
}
