export const taskStatuses = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const statusLabels: Record<TaskStatus, string> = {
  todo: "ยังไม่เริ่ม", in_progress: "กำลังทำ", done: "เสร็จแล้ว",
};
export type MutationState = { message: string; ok: boolean };
export const initialMutationState: MutationState = { message: "", ok: false };
export function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.some(status => status === value);
}
export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function bangkokToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function isOverdue(dueDate: string | null, status: TaskStatus, today = bangkokToday()) {
  return Boolean(dueDate && dueDate < today && status !== "done");
}
export function formatDueDate(dueDate: string | null) {
  if (!dueDate) return "ไม่มีกำหนด";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(dueDate + "T12:00:00Z"));
}
