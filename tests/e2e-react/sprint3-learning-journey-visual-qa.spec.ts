import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Scenario =
  | 'new'
  | 'selected'
  | 'baseline'
  | 'weak-prerequisite'
  | 'practice'
  | 'challenge'
  | 'mastered'
  | 'unfinished'
  | 'unavailable';

const capturePhase = process.env.SPRINT3_VISUAL_QA_CAPTURE ?? 'after';
const testAuth = { role: 'student', email: 'student.e2e@projectodysseus.test' };
const wholeNumbers = 'G9-T1-WHOLE-NUMBERS';
const integers = 'G9-T1-INTEGERS';
const patterns = 'G9-T1-NUMERIC-GEOMETRIC-PATTERNS';
const baselineDefinition = '10000000-0000-0000-0000-000000000001';
const challengeDefinition = '10000000-0000-0000-0000-000000000002';
const sessionId = '20000000-0000-0000-0000-000000000001';
const activityCode = 'ACT.TEST.G9.T1.INTEGER.SIGNS';

const topicNames: Record<string, string> = {
  [wholeNumbers]: 'Whole Numbers',
  [integers]: 'Integers',
  'G9-T1-EXPONENTS': 'Exponents',
  [patterns]: 'Numeric and Geometric Patterns',
};

function topic(code: string, status: string, topicMasteryStatus: string | null = null, contentAvailable = true) {
  return {
    topicCode: code,
    topicName: topicNames[code],
    topicDescription: `Approved test-only ${topicNames[code]} learning content.`,
    status,
    topicMasteryStatus,
    reasonCodes: [],
    lastUpdatedAt: '2026-11-09T12:00:00.000Z',
    contentAvailable,
    availableAssessmentTypes: [],
    focusSkillCode: null,
  };
}

function topicsFor(scenario: Scenario) {
  return [
    topic(wholeNumbers, scenario === 'mastered' ? 'mastered' : scenario === 'challenge' ? 'mastery_challenge_available' : 'not_started', scenario === 'mastered' ? 'mastered' : null),
    topic(integers, scenario === 'selected' || scenario === 'baseline' ? 'baseline_available' : scenario === 'unfinished' ? 'learning_in_progress' : 'not_started', scenario === 'unfinished' ? null : null),
    topic('G9-T1-EXPONENTS', 'not_started'),
    topic(patterns, scenario === 'unavailable' ? 'content_unavailable' : 'not_started', null, scenario !== 'unavailable'),
  ];
}

function primaryFor(scenario: Scenario, selectedTopicCode: string | null) {
  if (scenario === 'baseline' || scenario === 'selected') return {
    action: 'start_baseline', topicCode: selectedTopicCode ?? integers, assessmentDefinitionId: baselineDefinition,
    title: 'Understand your starting point', description: 'Take a short independent baseline so we can recommend the most useful next step.',
    route: `/dashboard/student/learning/assessment/${baselineDefinition}`, reasonCodes: ['BASELINE_AVAILABLE'],
  };
  if (scenario === 'weak-prerequisite') return {
    action: 'continue_learning', topicCode: integers, activityCode,
    title: 'Build a useful Grade 8 foundation', description: 'A short, approved prerequisite activity will make your next Grade 9 step easier.',
    route: `/dashboard/student/learning/activity/${activityCode}`, reasonCodes: ['PREREQUISITE_NOT_SECURE'],
  };
  if (scenario === 'practice' || scenario === 'unfinished') return {
    action: scenario === 'unfinished' ? 'continue_learning' : 'continue_learning', topicCode: integers, activityCode,
    title: scenario === 'unfinished' ? 'Continue your activity' : 'Practise integer signs', description: 'Pick up the reviewed activity where you left off.',
    route: `/dashboard/student/learning/activity/${activityCode}`, reasonCodes: ['LEARNING_ACTIVITY_IN_PROGRESS'],
  };
  if (scenario === 'challenge') return {
    action: 'start_mastery_challenge', topicCode: wholeNumbers, assessmentDefinitionId: challengeDefinition,
    title: 'Your mastery challenge is ready', description: 'Your strong baseline has opened an independent mastery challenge.',
    route: `/dashboard/student/learning/assessment/${challengeDefinition}`, reasonCodes: ['STRONG_BASELINE_CHALLENGE_AVAILABLE'],
  };
  return {
    action: 'explore_topic', topicCode: null, title: 'Choose a Grade 9 topic',
    description: 'Choose a topic to see reviewed learning and the next independent assessment.',
    route: '/dashboard/student/learning', reasonCodes: ['NO_APPROVED_CONTENT'],
  };
}

function assessment(definitionId: string, assessmentType: 'topic_baseline' | 'mastery_challenge', topicCode: string, name: string) {
  return { definitionId, formVersionId: `${definitionId}-form`, name, assessmentType, topicCode, topicName: topicNames[topicCode], durationMinutes: 20, questionCount: 4 };
}

function resultSession(status: 'in_progress' | 'submitted' = 'in_progress', selectedOption: 'A' | 'B' | 'C' | 'D' | null = null, mastered = false) {
  return {
    sessionId, status, startedAt: '2026-11-09T19:20:00.000Z', expiresAt: '2026-11-09T19:45:00.000Z', serverNow: '2026-11-09T19:25:00.000Z',
    assessment: { name: mastered ? 'Whole Numbers mastery challenge — test-only form' : 'Integers baseline — test-only form', assessmentType: mastered ? 'mastery_challenge' : 'topic_baseline', topicCode: mastered ? wholeNumbers : integers, topicName: mastered ? 'Whole Numbers' : 'Integers', durationMinutes: 20 },
    questions: [{ sessionQuestionId: '30000000-0000-0000-0000-000000000001', sequenceNumber: 1, prompt: 'Evaluate: −8 + 13.', options: { A: '5', B: '−5', C: '21', D: '−21' }, selectedOption }],
    result: status === 'submitted' ? {
      rawScore: 4, totalMarks: 4, percentage: 100,
      recommendation: { nextStep: mastered ? 'advance_to_dependent_topic' : 'mastery_challenge_available', focusSkillCode: null, reasonCodes: [mastered ? 'TOPIC_MASTERY_DEMONSTRATED' : 'STRONG_BASELINE'] },
      topicMastery: { status: mastered ? 'mastered' : 'evidence_incomplete', reasonCodes: [mastered ? 'TOPIC_MASTERY_DEMONSTRATED' : 'MASTERY_CHALLENGE_REQUIRED'], criticalSkillCoverage: 100, reasoningAchievement: 100, reasoningEvidenceCount: 2 },
      skillBreakdown: [{ skillCode: 'G9-INT-SIGNED-OPERATIONS', skillName: 'Signed integer operations', correct: 4, total: 4, percentage: 100 }],
      questionFeedback: [],
    } : null,
  };
}

async function useScenario(page: Page, scenario: Scenario) {
  let selectedTopicCode: string | null = scenario === 'selected' || scenario === 'baseline' ? integers : null;
  let selectedOption: 'A' | 'B' | 'C' | 'D' | null = null;
  let submitted = scenario === 'mastered';
  let practiceComplete = false;

  await page.addInitScript((auth) => window.localStorage.setItem('project-odysseus:e2e-auth', JSON.stringify(auth)), testAuth);
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const rpc = route.request().url().split('/').pop() ?? '';
    const input = route.request().postDataJSON() as Record<string, string> | null;
    const currentTopics = topicsFor(scenario);
    const currentTopic = currentTopics.find((item) => item.topicCode === (selectedTopicCode ?? primaryFor(scenario, selectedTopicCode).topicCode)) ?? null;
    const journey = {
      primary: primaryFor(scenario, selectedTopicCode), topics: currentTopics, currentTopic,
      alternatives: [], prerequisiteRecommendation: scenario === 'weak-prerequisite' ? { activityCode, skillCode: 'G8-INT-OPERATIONS', reasonCodes: ['PREREQUISITE_NOT_SECURE'], originTopicCode: integers } : null,
      lastProgressAt: '2026-11-09T12:00:00.000Z', contentAvailable: scenario !== 'unavailable',
      context: selectedTopicCode ? { selectedTopicCode, focusSkillCode: null, originTopicCode: selectedTopicCode, updatedAt: '2026-11-09T12:00:00.000Z' } : {},
    };
    const assessments = [
      assessment(baselineDefinition, 'topic_baseline', integers, 'Integers baseline — test-only form'),
      assessment(challengeDefinition, 'mastery_challenge', wholeNumbers, 'Whole Numbers mastery challenge — test-only form'),
    ];
    const catalogue = [{ topicCode: integers, topicName: 'Integers', topicDescription: 'Approved test-only content for visual QA.', areaName: 'Numbers', skills: [{ skillCode: 'G9-INT-SIGNED-OPERATIONS', skillName: 'Signed integer operations', skillDescription: 'Work accurately with positive and negative integers.', activityCode, hasExplanation: true }] }];
    const topicData = input?.p_topic_code === patterns && scenario === 'unavailable'
      ? { topicCode: patterns, topicName: topicNames[patterns], topicDescription: 'No approved test-only content is available.', areaName: 'Patterns', skills: [] }
      : { ...catalogue[0], skills: [{ ...catalogue[0].skills[0], activityName: 'Practise integer signs', content: { title: 'Integer signs', explanation: 'Use a number line to check the direction of each move.', workedExample: '−8 + 13 = 5 because 13 moves right from −8.' } }] };
    const activity = { activityCode, name: 'Practise integer signs', description: 'A short, guided test-only practice activity.', targetSkillCode: 'G9-INT-SIGNED-OPERATIONS', stages: [{ id: 'stage-1', sequence: 1, type: 'guided_practice', instruction: 'Choose an answer, then check your reasoning.', questionVersionIds: ['question-1'] }] };
    const answers: Record<string, unknown> = {
      get_my_available_learning_diagnostics: [], get_my_learning_mastery_summary: [], get_my_grade9_learning_catalogue: catalogue,
      get_my_approved_learning_video_resources: [], get_my_available_learning_assessments: assessments,
      get_my_grade9_term1_learning_journey: journey, get_my_due_learning_retention_step: null,
      get_my_next_learning_step: scenario === 'practice' ? { activityCode, name: activity.name, description: activity.description, targetSkillCode: activity.targetSkillCode, targetSkillName: 'Signed integer operations', estimatedMinutes: 8, learnerReason: 'Practise a common sign misconception.' } : null,
      get_my_grade9_learning_topic: topicData, start_my_learning_activity: null, get_my_learning_activity: activity,
      get_my_learning_activity_state: [{ question_version_id: 'question-1', stage_id: 'stage-1', stage_sequence: 1, stage_type: 'guided_practice', stage_instruction: 'Choose an answer, then check your reasoning.', question_sequence: 1, attempt_id: practiceComplete ? 'attempt-1' : null, attempt_status: practiceComplete ? 'submitted' : null }],
      get_learning_question_display: [{ question_version_id: 'question-1', prompt: 'Calculate: −6 + 10.', marks: 1, question_type: 'multiple_choice', options: [{ value: '4', label: '4' }, { value: '−4', label: '−4' }, { value: '16', label: '16' }, { value: '−16', label: '−16' }], activity_type: 'guided_practice', representation: 'symbolic', calculator_policy: 'not_allowed', hints: [] }],
      set_my_grade9_term1_learning_context: null, start_my_learning_assessment: sessionId,
      get_my_learning_assessment_session: resultSession(submitted ? 'submitted' : 'in_progress', selectedOption, scenario === 'mastered'),
      save_my_learning_assessment_answer: null, submit_my_learning_assessment: sessionId, complete_my_learning_activity: null,
    };
    if (rpc === 'set_my_grade9_term1_learning_context') selectedTopicCode = input?.p_topic_code ?? selectedTopicCode;
    if (rpc === 'save_my_learning_assessment_answer') selectedOption = input?.p_selected_option as 'A' | 'B' | 'C' | 'D';
    if (rpc === 'submit_my_learning_assessment') submitted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answers[rpc] ?? null) });
  });
  await page.route('**/functions/v1/evaluate-learning-attempt', async (route) => {
    practiceComplete = true;
    await route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ attempt_id: 'attempt-1', attempt_status: 'submitted', evaluation: { status: 'correct', marksAwarded: 1, marksAvailable: 1, misconceptionMatches: [] } }),
    });
  });
}

async function capture(page: Page, testInfo: TestInfo, scenario: Scenario, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`sprint3-visual-qa/${capturePhase}/${scenario}-${width}.png`), fullPage: false });
}

async function openLearning(page: Page, scenario: Scenario, testInfo: TestInfo) {
  await useScenario(page, scenario);
  await page.goto('/dashboard/student/learning');
  await expect(page.getByRole('heading', { level: 1, name: 'Learning' })).toBeVisible();
  await capture(page, testInfo, scenario, 1440);
  await capture(page, testInfo, scenario, 390);
}

test('visual QA — new learner sees a calm topic-choice starting point', async ({ page }, testInfo) => {
  await openLearning(page, 'new', testInfo);
  await expect(page.getByText('Choose a Grade 9 topic', { exact: true })).toBeVisible();
});

test('visual QA — selected topic makes its baseline the clear next step', async ({ page }, testInfo) => {
  await openLearning(page, 'selected', testInfo);
  await expect(page.getByText('Understand your starting point', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View roadmap' }).nth(1).click();
  await expect(page.getByRole('button', { name: 'This is my current topic' })).toBeVisible();
});

test('visual QA — learner can start a baseline on mobile', async ({ page }, testInfo) => {
  await useScenario(page, 'baseline');
  await page.goto(`/dashboard/student/learning/assessment/${baselineDefinition}`);
  await expect(page.getByRole('button', { name: 'Start assessment' })).toBeVisible();
  await capture(page, testInfo, 'baseline-introduction', 1440);
  await capture(page, testInfo, 'baseline-introduction', 390);
  await page.getByRole('button', { name: 'Start assessment' }).click();
  await expect(page.getByText('Evaluate: −8 + 13.')).toBeVisible();
  await expect(page.getByRole('radio', { name: /A\s+5/ })).toBeVisible();
});

test('visual QA — weak prerequisite evidence is supportive rather than punitive', async ({ page }, testInfo) => {
  await openLearning(page, 'weak-prerequisite', testInfo);
  await expect(page.getByText('A useful foundation before your next step')).toBeVisible();
});

test('visual QA — strong baseline learner sees a mastery challenge', async ({ page }, testInfo) => {
  await openLearning(page, 'challenge', testInfo);
  await expect(page.getByText('Your mastery challenge is ready', { exact: true })).toBeVisible();
});

test('visual QA — successful mastery result is legible and roadmap ticks are evidence-based', async ({ page }, testInfo) => {
  await useScenario(page, 'mastered');
  await page.goto(`/dashboard/student/learning/assessment/session/${sessionId}`);
  await expect(page.getByText('Assessment submitted')).toBeVisible();
  await capture(page, testInfo, 'mastery-result', 1440);
  await capture(page, testInfo, 'mastery-result', 390);
  await page.goto(`/dashboard/student/learning/topic/${wholeNumbers}`);
  await expect(page.getByText('Step 5 — Mastery and next steps')).toBeVisible();
  const checks = page.locator('[aria-labelledby="topic-roadmap-heading"] svg');
  if (capturePhase === 'before') await expect(checks).toHaveCount(5);
  else await expect(checks).toHaveCount(2);
});

test('visual QA — returning learner resumes unfinished guided work', async ({ page }, testInfo) => {
  await openLearning(page, 'unfinished', testInfo);
  await expect(page.getByText('Continue your activity', { exact: true })).toBeVisible();
});

test('visual QA — guided practice gives feedback and a clear completion state', async ({ page }, testInfo) => {
  await useScenario(page, 'practice');
  await page.goto(`/dashboard/student/learning/activity/${activityCode}`);
  await expect(page.getByRole('heading', { name: 'Calculate: −6 + 10.' })).toBeVisible();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByText('Very sure', { exact: true }).click();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('button', { name: /Continue to next step/ })).toBeVisible();
  await page.getByRole('button', { name: /Continue to next step/ }).click();
  await expect(page.getByRole('heading', { name: 'Activity complete' })).toBeVisible();
  await capture(page, testInfo, 'guided-practice-complete', 1440);
  await capture(page, testInfo, 'guided-practice-complete', 390);
});

test('visual QA — unavailable content gives an explanation without a self-referential action', async ({ page }, testInfo) => {
  await useScenario(page, 'unavailable');
  await page.goto(`/dashboard/student/learning/topic/${patterns}`);
  await expect(page.getByText('Learning content is being reviewed')).toBeVisible();
  await capture(page, testInfo, 'unavailable', 1440);
  await capture(page, testInfo, 'unavailable', 390);
  const unavailable = page.getByText('Learning content is being reviewed').locator('..').locator('..');
  if (capturePhase === 'before') await expect(unavailable.getByRole('link', { name: 'Back to Learning' })).toBeVisible();
  else await expect(unavailable.getByRole('link', { name: 'Back to Learning' })).toHaveCount(0);
});
