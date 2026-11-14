import { requireUser } from "@/lib/auth";
import { SiteHeader } from "@/app/components/site-header";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <><SiteHeader />{children}</>;
}
