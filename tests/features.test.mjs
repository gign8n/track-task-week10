import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real Server Actions with an isolated Supabase boundary.
// These tests never connect to, or modify, the user's database.
function load(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: relative });
  return compiledModule.exports;
}
const rules = load("../lib/task-rules.ts");
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const taskId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const initial = { ok: false, message: "" };
function form(values) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
function harness(options = {}) {
  const writes = [];
  const invalidations = [];
  const userId = options.userId ?? owner;
  const context = options.noTeam ? null : {
    team: { id: teamId, owner_id: owner }, userId,
    isOwner: userId === owner,
    members: [{ user_id: owner }, { user_id: member }],
  };
  const supabase = {
    from(table) {
      assert.equal(table, "tasks");
      const query = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: options.readTask === null ? null : { id: taskId, assignee_id: options.assigneeId ?? member }, error: null };
        },
        insert(payload) {
          writes.push({ operation: "insert", payload });
          return { select: () => ({ single: async () => ({ data: { id: taskId }, error: null }) }) };
        },
        update(payload) {
          writes.push({ operation: "update", payload });
          const result = {
            eq() { return this; }, select() { return this; },
            async maybeSingle() { return { data: options.zeroUpdated ? null : { id: taskId }, error: null }; },
          };
          return result;
        },
      };
      return query;
    },
  };
  const actions = load("../app/(workspace)/tasks/actions.ts", {
    "next/cache": { revalidatePath: value => invalidations.push(value) },
    "@/lib/auth": { requireUser: async () => {
      if (options.loggedOut) throw new Error("LOGIN_REQUIRED");
      return { id: userId };
    } },
    "@/lib/team": { getTeamContext: async () => context },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/task-rules": rules,
  });
  return { ...actions, writes, invalidations };
}
const newTask = { title: "ทดสอบงาน", assignee_id: member, due_date: "2026-11-14" };

test("AC-3.1 accepts a teammate and derives team/creator/status from trusted state", async () => {
  const h = harness();
  const result = await h.createTask(initial, form({ ...newTask, team_id: outsider, created_by: outsider, status: "done" }));
  assert.equal(result.ok, true);
  assert.equal(h.writes[0].payload.team_id, teamId);
  assert.equal(h.writes[0].payload.created_by, owner);
  assert.equal(h.writes[0].payload.status, "todo");
  assert.equal(h.writes[0].payload.assignee_id, member);
  assert.ok(h.invalidations.includes("/tasks"));
});
test("AC-3.1 owner can assign a task to themselves without a due date", async () => {
  const h = harness();
  assert.equal((await h.createTask(initial, form({ title: "งานหัวหน้า", assignee_id: owner }))).ok, true);
  assert.equal(h.writes[0].payload.due_date, null);
});
test("AC-3.3 member cannot create tasks", async () => {
  const h = harness({ userId: member });
  assert.equal((await h.createTask(initial, form(newTask))).ok, false);
  assert.equal(h.writes.length, 0);
});
test("AC-3.4 forged outsider assignee is rejected before writing", async () => {
  const h = harness();
  assert.equal((await h.createTask(initial, form({ ...newTask, assignee_id: outsider }))).ok, false);
  assert.equal(h.writes.length, 0);
});
test("AC-3.5 whitespace-only titles are rejected", async () => {
  const h = harness();
  assert.equal((await h.createTask(initial, form({ ...newTask, title: "   " }))).message, "กรุณากรอกชื่องาน");
  assert.equal(h.writes.length, 0);
});
test("no team and invalid calendar dates cannot create a task", async () => {
  for (const options of [{ noTeam: true }, {}]) {
    const h = harness(options);
    const input = options.noTeam ? newTask : { ...newTask, due_date: "2026-02-30" };
    assert.equal((await h.createTask(initial, form(input))).ok, false);
    assert.equal(h.writes.length, 0);
  }
});
test("AC-4.1 assignee updates status only", async () => {
  const h = harness({ userId: member });
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "in_progress" }))).ok, true);
  assert.equal(JSON.stringify(h.writes[0].payload), JSON.stringify({ status: "in_progress" }));
});
test("AC-4.2 owner may update another member's task", async () => {
  const h = harness();
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "done" }))).ok, true);
});
test("AC-4.3 member cannot update another member's task", async () => {
  const h = harness({ userId: member, assigneeId: owner });
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "done" }))).ok, false);
  assert.equal(h.writes.length, 0);
});
test("AC-3.7 invisible task cannot be updated", async () => {
  const h = harness({ readTask: null });
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "done" }))).ok, false);
  assert.equal(h.writes.length, 0);
});
test("AC-4.4 protected fields are rejected even alongside a valid status", async () => {
  for (const field of ["title", "description", "due_date", "assignee_id", "team_id", "created_by", "created_at", "updated_at", "id"]) {
    const h = harness({ userId: member });
    assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "done", [field]: "forged" }))).ok, false);
    assert.equal(h.writes.length, 0);
  }
});
test("zero updated rows must not report success", async () => {
  const h = harness({ zeroUpdated: true });
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "done" }))).ok, false);
});
test("unsupported statuses are rejected", async () => {
  const h = harness();
  assert.equal((await h.updateTaskStatus(initial, form({ task_id: taskId, status: "archived" }))).ok, false);
  assert.equal(h.writes.length, 0);
});
test("unauthenticated writes require login", async () => {
  const h = harness({ loggedOut: true });
  await assert.rejects(h.createTask(initial, form(newTask)), /LOGIN_REQUIRED/);
  assert.equal(h.writes.length, 0);
});
test("AC-4.5 Bangkok midnight determines overdue, not UTC midnight", () => {
  assert.equal(rules.bangkokToday(new Date("2026-11-14T16:59:59Z")), "2026-11-14");
  assert.equal(rules.bangkokToday(new Date("2026-11-14T17:00:00Z")), "2026-11-15");
  assert.equal(rules.isOverdue("2026-11-14", "todo", "2026-11-15"), true);
  assert.equal(rules.isOverdue("2026-11-15", "todo", "2026-11-15"), false);
  assert.equal(rules.isOverdue("2026-11-14", "done", "2026-11-15"), false);
  assert.equal(rules.isOverdue(null, "todo", "2026-11-15"), false);
});
test("date validation handles leap years and Thai formatting preserves the day", () => {
  assert.equal(rules.isValidDate("2024-02-29"), true);
  assert.equal(rules.isValidDate("2026-02-29"), false);
  assert.equal(rules.formatDueDate(null), "ไม่มีกำหนด");
  assert.match(rules.formatDueDate("2026-11-14"), /14/);
});

function teamHarness(error = null) {
  const calls = [];
  const actions = load("../app/(workspace)/team/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
    "@/lib/auth": { requireUser: async () => ({ id: owner }) },
    "@/lib/supabase/server": { createClient: async () => ({
      rpc: async (name, payload) => { calls.push({ name, payload }); return { data: teamId, error }; },
    }) },
    "@/lib/task-rules": rules,
  });
  return { ...actions, calls };
}
test("AC-2.2 team creation forwards only a name; identity/role come from database", async () => {
  const h = teamHarness();
  await assert.rejects(h.saveTeam(initial, form({ intent: "create", name: " ทีมทดสอบ ", user_id: outsider, role: "owner" })), /REDIRECT:\/team/);
  assert.equal(h.calls[0].name, "create_team");
  assert.equal(JSON.stringify(h.calls[0].payload), JSON.stringify({ p_name: "ทีมทดสอบ" }));
});
test("AC-2.3 joining uses the guarded RPC without pre-reading the teams table", async () => {
  const h = teamHarness();
  await assert.rejects(h.saveTeam(initial, form({ intent: "join", invite_code: " ABC123 " })), /REDIRECT:\/team/);
  assert.equal(h.calls[0].name, "join_team");
  assert.equal(JSON.stringify(h.calls[0].payload), JSON.stringify({ p_code: "ABC123" }));
});
test("AC-2.3/2.4/2.5 database denials become the required Thai messages", async () => {
  for (const [code, expected] of [
    ["TEAM_NOT_FOUND", "ไม่พบทีมจากรหัสนี้"],
    ["ALREADY_IN_TEAM", "คุณมีทีมอยู่แล้ว"],
    ["TEAM_NAME_REQUIRED", "กรุณากรอกชื่อทีม"],
  ]) {
    const h = teamHarness({ message: code });
    const result = await h.saveTeam(initial, form({ intent: "create", name: "" }));
    assert.equal(result.ok, false);
    assert.equal(result.message, expected);
  }
});
test("internal database error details are not returned to the browser", async () => {
  const h = teamHarness({ message: "private table or internal details" });
  const result = await h.saveTeam(initial, form({ intent: "join", invite_code: "000000" }));
  assert.equal(result.ok, false);
  assert.equal(result.message.includes("private table"), false);
});
