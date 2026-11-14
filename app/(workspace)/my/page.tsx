import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function MyPage() {
  await requireUser();
  redirect("/team");
}
