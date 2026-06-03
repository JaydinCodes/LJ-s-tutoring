const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('daily welcome insight is deterministic, state-driven, and side-effect free', () => {
  const source = read('src', 'features', 'students', 'studentDailyInsight.ts');

  assert.ok(source.includes('return `${input.studentId}:${input.today}`'), 'daily seed must be scoped to learner and local date');
  assert.ok(source.includes("task.status === 'missing'"), 'overdue assignments must shape the insight');
  assert.ok(source.includes('input.nextExamDays <= 21'), 'exam season must switch to revision-focused copy');
  assert.ok(source.includes('input.weakestTopicScore < 65'), 'weak topic mastery must shape the insight');
  assert.ok(source.includes('input.attendanceRate < 75'), 'low attendance must shape the insight');
  assert.ok(source.includes('input.averageScore < 65'), 'recent marks must shape the insight');
  assert.ok(source.includes('(input.streakDays || 0) >= 3'), 'streak momentum must shape the insight');
  assert.ok(!source.includes('Math.random'), 'daily copy must not change randomly during the day');
  assert.ok(!source.includes('apiPost'), 'selecting a welcome message must not perform API writes');
});

test('dashboard projects real exam context into the daily welcome card', () => {
  const repository = read('src', 'features', 'students', 'studentDashboardRepository.ts');
  const route = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');
  const components = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const academicApi = read('lms-api', 'src', 'routes', 'academic.ts');
  const adminApi = read('lms-api', 'src', 'routes', 'admin.ts');
  const migration = read('lms-api', 'prisma', 'migrations', '20260602_student_daily_insight', 'migration.sql');

  assert.ok(repository.includes('dailyInsightContext:'), 'repository must retain dashboard insight context');
  assert.ok(route.includes('selectDailyInsight(data, studentData)'), 'dashboard route must derive the daily card from learner state');
  assert.ok(components.includes('dailyInsight.message'), 'welcome card must render the selected state-driven message');
  assert.ok(academicApi.includes('from student_exam_events'), 'dashboard API must read the learner exam calendar');
  assert.ok(academicApi.includes('dailyInsightContext:'), 'dashboard API must expose nearest-exam and momentum context');
  assert.ok(adminApi.includes("app.post('/admin/exam-events'"), 'admins must be able to record real exam dates');
  assert.ok(migration.includes('create table if not exists student_exam_events'), 'exam dates must have a durable read model');
});
