import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/lib/task-rules";

export type Team = { id: string; name: string; owner_id: string; invite_code: string };
export type Member = { user_id: string; display_name: string; email: string };
export type TeamContext = { userId: string; team: Team; members: Member[]; isOwner: boolean };
export type Task = {
  id: string; team_id: string; title: string; description: string | null;
  due_date: string | null; assignee_id: string; status: TaskStatus;
  created_at: string; updated_at: string;
};

export const getTeamContext = cache(async (): Promise<TeamContext | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error("โหลดทีมไม่สำเร็จ กรุณาตรวจ SQL ของ US-2");
  if (!membership) return null;
  const { data: team, error: teamError } = await supabase.from("teams")
    .select("id, name, owner_id, invite_code").eq("id", membership.team_id).single();
  if (teamError || !team) throw new Error("โหลดข้อมูลทีมไม่สำเร็จ");
  const { data: memberships, error: membersError } = await supabase.from("team_members")
    .select("user_id").eq("team_id", team.id).order("joined_at");
  if (membersError || !memberships?.length) throw new Error("โหลดสมาชิกไม่สำเร็จ");
  const { data: profiles, error: profilesError } = await supabase.from("profiles")
    .select("user_id, display_name, email").in("user_id", memberships.map(member => member.user_id));
  if (profilesError || !profiles || profiles.length !== memberships.length) throw new Error("โหลดชื่อสมาชิกไม่สำเร็จ");
  const members = memberships.map(member => profiles.find(profile => profile.user_id === member.user_id)!) as Member[];
  return { userId: user.id, team: team as Team, members, isOwner: team.owner_id === user.id };
});

export async function getTeamTasks(teamId: string): Promise<Task[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks")
    .select("id, team_id, title, description, due_date, assignee_id, status, created_at, updated_at")
    .eq("team_id", teamId).order("created_at", { ascending: false }).order("id");
  if (error) throw new Error("โหลดงานไม่สำเร็จ กรุณาตรวจ SQL ของ US-3 และ US-4");
  return (data ?? []) as Task[];
}
