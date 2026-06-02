const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test("Today's Battle Plan selector follows the required priority queue", () => {
  const source = read('src', 'features', 'students', 'studentBattlePlan.ts');

  assert.ok(source.includes('MAX_BATTLE_PLAN_ITEMS = 5'), 'battle plan must cap at five actions');
  assert.ok(source.includes('MIN_BATTLE_PLAN_ITEMS = 3'), 'battle plan must target at least three actions');
  assert.ok(source.includes('dueInDays != null && dueInDays < 0'), 'overdue assignments must be first-priority candidates');
  assert.ok(source.includes('dueInDays === 0'), 'due-today assignments must be second-priority candidates');
  assert.ok(source.includes('data.examCalendar?.nextExam'), 'upcoming exams must come from calendar data');
  assert.ok(source.includes('data.progress'), 'weak topics must come from progress data');
  assert.ok(source.includes('data.recommendedQuiz'), 'recommended quiz must come from quiz payload data');
  assert.ok(source.includes('data.careerGoals?.[0]'), 'career action must come from career data when present');
  assert.ok(source.includes('.slice(0, MAX_BATTLE_PLAN_ITEMS)'), 'selector must return no more than five items');
});

test('Battle Plan cards show time estimates and move completed actions down', () => {
  const selector = read('src', 'features', 'students', 'studentBattlePlan.ts');
  const components = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const route = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');

  assert.ok(selector.includes('estimatedMinutes'), 'each battle plan item must include an estimate');
  assert.ok(selector.includes('sortBattlePlanForDisplay'), 'completed item ordering must be centralized');
  assert.ok(selector.includes('return leftDone ? 1 : -1'), 'completed actions must move below active actions');
  assert.ok(components.includes("Today's Battle Plan"), 'dashboard must render the Battle Plan section');
  assert.ok(components.includes('Mark complete'), 'cards must support local completion');
  assert.ok(components.includes('line-through'), 'completed cards must visually collapse');
  assert.ok(components.includes('{item.estimatedMinutes} min'), 'cards must show estimated time');
  assert.ok(route.includes('selectTodayBattlePlan(data, studentData)'), 'dashboard route must derive the Battle Plan from learner state');
  assert.ok(route.includes('<TodayBattlePlan items={battlePlan}'), 'dashboard route must render the Battle Plan');
});

test('dashboard repository projects quiz, recommendation, and career payloads into student state', () => {
  const repository = read('src', 'features', 'students', 'studentDashboardRepository.ts');
  const types = read('src', 'types', 'lms.ts');
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  assert.ok(types.includes('recommendedQuiz?:'), 'dashboard view must type optional recommended quiz data');
  assert.ok(types.includes('recommendedNext?:'), 'dashboard view must type recommended study action data');
  assert.ok(types.includes('careerGoals?:'), 'dashboard view must type career action data');
  assert.ok(repository.includes('recommendedQuiz:'), 'repository must retain recommended quiz data');
  assert.ok(repository.includes('recommendedNext:'), 'repository must retain recommended study action data');
  assert.ok(repository.includes('careerGoals:'), 'repository must retain career action data');
  assert.ok(api.includes('recommendedQuiz'), 'API must expose recommended quiz context');
});
