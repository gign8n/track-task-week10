"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-12">
    <h1 className="text-2xl font-bold text-blue-900">โหลดข้อมูลไม่สำเร็จ</h1>
    <p role="alert" className="mt-3">กรุณาตรวจการเชื่อมต่อ และตรวจว่าได้รัน SQL ของ US-1 ถึง US-4 ใน Supabase แล้ว จากนั้นลองใหม่</p>
    <button onClick={reset} className="mt-5 rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white">ลองใหม่</button>
    <a href="/login" className="ml-4 inline-block py-3 text-blue-800 underline">ไปหน้าเข้าสู่ระบบ</a>
  </main>;
}
