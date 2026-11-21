import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

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

async function useScenario(page: Page, scenario: Scenario, overrides: Record<string, unknown> = {}, evaluations: Array<Record<string, unknown> | null> = []) {
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
    const mapTopicCode = input?.p_topic_code ?? integers;
    const topicMap = {
      topicCode: mapTopicCode,
      topicName: topicNames[mapTopicCode],
      skills: [{
        skillCode: 'G9-INT-SIGNED-OPERATIONS', skillName: 'Signed integer operations', skillDescription: 'Work accurately with positive and negative integers.',
        lessonAvailable: !(mapTopicCode === patterns && scenario === 'unavailable'), activityCode: mapTopicCode === patterns && scenario === 'unavailable' ? null : activityCode,
        practiceStatus: practiceComplete ? 'completed' : scenario === 'unfinished' ? 'in_progress' : 'not_started', practiceAttempted: practiceComplete,
        skillEvidenceState: scenario === 'mastered' ? 'secure' : null, skillEvidenceAt: scenario === 'mastered' ? '2026-11-09T12:00:00.000Z' : null,
      }],
      baseline: { status: scenario === 'baseline' ? 'available' : scenario === 'weak-prerequisite' || scenario === 'mastered' ? 'completed' : 'unavailable' },
      endline: { status: scenario === 'mastered' ? 'completed' : 'unavailable' },
    };
    const activity = { activityCode, name: 'Practise integer signs', description: 'A short, guided test-only practice activity.', targetSkillCode: 'G9-INT-SIGNED-OPERATIONS', stages: [{ id: 'stage-1', sequence: 1, type: 'guided_practice', instruction: 'Choose an answer, then check your reasoning.', questionVersionIds: ['question-1'] }] };
    const answers: Record<string, unknown> = {
      get_my_available_learning_diagnostics: [], get_my_learning_mastery_summary: [], get_my_grade9_learning_catalogue: catalogue,
      get_my_approved_learning_video_resources: [], get_my_available_learning_assessments: assessments,
      get_my_grade9_term1_learning_journey: journey, get_my_due_learning_retention_step: null,
      get_my_grade9_term1_topic_learning_map: topicMap,
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...answers, ...overrides }[rpc] ?? null) });
  });
  await page.route('**/functions/v1/evaluate-learning-attempt', async (route) => {
    practiceComplete = true;
    const evaluation = evaluations.length ? evaluations.shift() : { status: 'correct', marksAwarded: 1, marksAvailable: 1, misconceptionMatches: [] };
    await route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ attempt_id: 'attempt-1', attempt_status: 'submitted', evaluation }),
    });
  });
}

async function capture(page: Page, testInfo: TestInfo, scenario: string, width: number, focus?: Locator) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  if (focus) await focus.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`sprint3-visual-qa/${capturePhase}/${scenario}-${width}.png`), fullPage: false });
}

async function openLearning(page: Page, scenario: Scenario, testInfo: TestInfo) {
  await useScenario(page, scenario);
  await page.goto('/dashboard/student/learning');
  await expect(page.getByRole('heading', { level: 1, name: 'Learning' })).toBeVisible();
  await capture(page, testInfo, scenario, 1440);
  await capture(page, testInfo, scenario, 390);
  await capture(page, testInfo, scenario, 360);
}

test('visual QA — new learner sees a calm topic-choice starting point', async ({ page }, testInfo) => {
  await openLearning(page, 'new', testInfo);
  await expect(page.getByText('Choose a Grade 9 topic', { exact: true })).toBeVisible();
});

test('visual QA — selected topic makes its baseline the clear next step', async ({ page }, testInfo) => {
  await openLearning(page, 'selected', testInfo);
  await expect(page.getByText('Understand your starting point', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Integers/ }).first().click();
  await expect(page.getByRole('button', { name: 'This is my current topic' })).toBeVisible();
  const mapHeading = page.getByRole('heading', { name: 'Your learning path', exact: true });
  await expect(mapHeading).toBeVisible();
  await capture(page, testInfo, 'integers-topic-map', 1440, mapHeading);
  await capture(page, testInfo, 'integers-topic-map', 390, mapHeading);
  await capture(page, testInfo, 'integers-topic-map', 360, mapHeading);
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
  await page.goto(`/dashboard/student/learning/topic/${integers}`);
  await expect(page.getByText('Helpful Grade 8 detour')).toBeVisible();
  await capture(page, testInfo, 'grade8-prerequisite-branch', 390, page.getByText('Helpful Grade 8 detour'));
});

test('visual QA — strong baseline learner sees a mastery challenge', async ({ page }, testInfo) => {
  await openLearning(page, 'challenge', testInfo);
  await expect(page.getByText('Your mastery challenge is ready', { exact: true })).toBeVisible();
});

test('visual QA — successful mastery result is legible and the map uses formal evidence', async ({ page }, testInfo) => {
  await useScenario(page, 'mastered');
  await page.goto(`/dashboard/student/learning/assessment/session/${sessionId}`);
  await expect(page.getByText('Assessment submitted')).toBeVisible();
  await capture(page, testInfo, 'mastery-result', 1440);
  await capture(page, testInfo, 'mastery-result', 390);
  await page.goto(`/dashboard/student/learning/topic/${wholeNumbers}`);
  await expect(page.getByRole('heading', { name: 'Your learning path', exact: true })).toBeVisible();
  await expect(page.getByText('Formal evidence has recorded mastery.')).toBeVisible();
  const mapHeading = page.getByRole('heading', { name: 'Your learning path', exact: true });
  await capture(page, testInfo, 'whole-numbers-topic-map', 1440, mapHeading);
  await capture(page, testInfo, 'whole-numbers-topic-map', 390, mapHeading);
});

test('visual QA — returning learner resumes unfinished guided work', async ({ page }, testInfo) => {
  await openLearning(page, 'unfinished', testInfo);
  await expect(page.getByText('Continue your activity', { exact: true })).toBeVisible();
});

test('learning overview prioritises continuing work and discloses course detail', async ({ page }, testInfo) => {
  await useScenario(page, 'unfinished');
  await page.goto('/dashboard/student/learning');
  const nextStep = page.getByRole('region', { name: 'Continue learning', exact: true });
  await expect(nextStep.getByRole('heading', { name: 'Continue your activity' })).toBeVisible();
  await expect(nextStep.getByRole('link', { name: 'Continue learning', exact: true })).toHaveAttribute('href', `/dashboard/student/learning/activity/${activityCode}`);
  await expect(page.getByRole('heading', { name: 'Learning journey', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Course content', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming actions', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing ready yet', { exact: true })).toHaveCount(0);
  await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(nextStep.getByRole('link', { name: 'Also available: 2 assessments' })).toBeVisible();
  await page.getByRole('link', { name: 'View progress' }).click();
  await expect(page.locator('.learning-progress-details')).toHaveAttribute('open', '');
  await expect(page.getByText('Your skill progress will appear after you complete learning activities.')).toBeVisible();
  await nextStep.scrollIntoViewIfNeeded();

  const content = page.getByRole('region', { name: 'Course content', exact: true });
  const disclosure = content.locator('summary').filter({ hasText: 'Integers' });
  await expect(content.getByText('Signed integer operations', { exact: true })).toBeHidden();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(content.getByText('Signed integer operations', { exact: true })).toBeVisible();
  await expect(content.getByRole('link', { name: 'Open topic' })).toHaveAttribute('href', `/dashboard/student/learning/topic/${integers}`);

  for (const width of [1440, 768, 390, 360]) {
    await capture(page, testInfo, 'learning-overview', width);
    await nextStep.scrollIntoViewIfNeeded();
    await expect(nextStep.getByRole('link', { name: 'Continue learning', exact: true })).toBeInViewport();
  }
});

test('learning overview announces loading until the journey is ready', async ({ page }, testInfo) => {
  await useScenario(page, 'unfinished');
  let releaseJourney = () => {};
  const pendingJourney = new Promise<void>((resolve) => { releaseJourney = resolve; });
  await page.route('**/rest/v1/rpc/get_my_grade9_term1_learning_journey', async (route) => {
    await pendingJourney;
    await route.fallback();
  });
  try {
    await page.goto('/dashboard/student/learning');
    await expect(page.getByRole('status').filter({ hasText: 'Loading your learning...' })).toHaveAttribute('aria-busy', 'true');
    await page.screenshot({ path: testInfo.outputPath('learning-loading.png') });
  } finally {
    releaseJourney();
  }
  await expect(page.getByRole('heading', { name: 'Continue your activity' })).toBeVisible();
});

test('learning overview gives an honest empty state without a dead-end action', async ({ page }, testInfo) => {
  await useScenario(page, 'new', {
    get_my_grade9_learning_catalogue: [],
    get_my_available_learning_assessments: [],
    get_my_grade9_term1_learning_journey: {
      primary: primaryFor('new', null), topics: [], currentTopic: null, context: {},
      alternatives: [], prerequisiteRecommendation: null, contentAvailable: false,
    },
  });
  await page.goto('/dashboard/student/learning');
  await expect(page.getByText('No learning action is available yet.')).toBeVisible();
  await expect(page.locator('.learning-primary')).toHaveCount(0);
  await expect(page.getByText('No additional actions right now.')).toBeVisible();
  await expect(page.getByText('No reviewed topics have been published yet.')).toBeVisible();
  await capture(page, testInfo, 'learning-empty', 390);
});

test('learning overview recovers from a core loading error', async ({ page }, testInfo) => {
  await useScenario(page, 'unfinished');
  let unavailable = true;
  await page.route('**/rest/v1/rpc/get_my_grade9_term1_learning_journey', async (route) => {
    if (!unavailable) return route.fallback();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Test-only unavailable journey' }) });
  });
  await page.goto('/dashboard/student/learning');
  await expect(page.getByText('Learning could not be loaded', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'learning-error', 390);
  unavailable = false;
  await page.getByRole('button', { name: /retry|try again/i }).click();
  await expect(page.getByRole('heading', { name: 'Continue your activity' })).toBeVisible();
});

test('learning overview keeps the next step usable when secondary data fails', async ({ page }) => {
  await useScenario(page, 'unfinished');
  let unavailable = true;
  await page.route('**/rest/v1/rpc/get_my_available_learning_assessments', async (route) => {
    if (!unavailable) return route.fallback();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Test-only unavailable assessments' }) });
  });
  await page.goto('/dashboard/student/learning');
  const nextStep = page.getByRole('region', { name: 'Continue learning', exact: true });
  await expect(nextStep.getByRole('link', { name: 'Continue learning', exact: true })).toBeVisible();
  const actions = page.getByRole('region', { name: 'Upcoming actions', exact: true });
  await expect(actions.getByRole('alert')).toBeVisible();
  await expect(nextStep.getByRole('link', { name: 'Continue learning', exact: true })).toBeVisible();
  unavailable = false;
  await actions.getByRole('button', { name: 'Try again' }).click();
  await expect(actions.getByRole('alert')).toHaveCount(0);
  await expect(actions.getByRole('link', { name: /Read instructions/ })).toHaveCount(2);
});

test('learning overview preserves completed diagnostics, optional review and formal progress', async ({ page }) => {
  await useScenario(page, 'mastered', {
    get_my_available_learning_diagnostics: [{ diagnostic_code: 'DONE', diagnostic_name: 'Starting check', diagnostic_description: 'Your starting evidence.', total_questions: 4, completed_questions: 4 }],
    get_my_due_learning_retention_step: { activityCode, retentionCheckId: 'review-test' },
    get_my_learning_mastery_summary: [{ skill_code: 'G9-INT-SIGNED-OPERATIONS', skill_name: 'Signed integer operations', state: 'secure', determined_at: '2026-11-09T12:00:00.000Z' }],
  });
  await page.goto('/dashboard/student/learning');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');
  await expect(page.getByRole('link', { name: /Whole Numbers Mastered/ })).toBeVisible();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Review completion/ })).toHaveAttribute('href', '/dashboard/student/learning/diagnostic/DONE');
  await expect(page.getByRole('link', { name: 'Start quick review' })).toHaveAttribute('href', `/dashboard/student/learning/activity/${activityCode}?retentionCheck=review-test`);
  await page.getByRole('link', { name: 'View progress' }).click();
  await expect(page.getByText('secure', { exact: true })).toBeVisible();
});

test('learning overview has accessible contrast and controls across themes and viewports', async ({ page }, testInfo) => {
  await useScenario(page, 'unfinished');
  await page.goto('/dashboard/student/learning');
  await expect(page.getByRole('heading', { name: 'Continue your activity' })).toBeVisible();
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const dark of [false, true]) {
    await page.evaluate((enabled) => document.documentElement.classList.toggle('dark', enabled), dark);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const violations = await page.evaluate(async () => {
        const { axe } = window as typeof window & { axe: { run: (context: string, options: { runOnly: string[] }) => Promise<{ violations: { id: string; description: string; nodes: { target: string[] }[] }[] }> } };
        return (await axe.run('.learning-overview', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations;
      });
      expect(violations, `${dark ? 'Dark' : 'Light'} theme at ${width}px`).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`learning-${dark ? 'dark' : 'light'}-${width}.png`), fullPage: true });
    }
  }
});

test('topic lesson loop connects the idea, worked example, practice and saved journey', async ({ page }, testInfo) => {
  await useScenario(page, 'practice');
  await page.goto(`/dashboard/student/learning/topic/${integers}`);
  await expect(page.getByRole('heading', { name: 'Your learning path', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Continue lesson', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Integer signs', exact: true })).toBeVisible();
  await expect(page.getByText('Use a number line to check the direction of each move.')).toBeVisible();
  await page.getByRole('link', { name: 'See examples', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Worked example', exact: true })).toBeVisible();
  await expect(page.getByText('−8 + 13 = 5 because 13 moves right from −8.')).toBeVisible();
  await page.getByRole('link', { name: 'Try it yourself', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`activity/${activityCode}.*topic=${integers}`));
  await expect(page.getByRole('heading', { name: 'Calculate: −6 + 10.' })).toBeVisible();
  await capture(page, testInfo, 'lesson-practice', 390);
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.locator('[data-state="feedback"]')).toBeVisible();
  await page.getByRole('button', { name: /Continue to next step/ }).click();
  await expect(page.getByRole('heading', { name: 'Activity complete', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Return to topic', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your learning path', exact: true })).toBeVisible();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
});

test('a legacy worked example keeps authored text intact instead of inventing a second numbering system', async ({ page }) => {
  await useScenario(page, 'practice', {
    get_my_grade9_learning_topic: { topicCode: integers, topicName: 'Integers', skills: [{ skillCode: 'G9-INT-SIGNED-OPERATIONS', skillName: 'Signed integer operations', activityCode, content: { title: 'Decimal calculations', explanation: 'Multiply the unit cost by the quantity.', workedExample: 'A notebook costs R24.50. Find the cost of 3 notebooks. R24.50 × 3 = R73.50.' } }] },
  });
  await page.goto(`/dashboard/student/learning/topic/${integers}?lesson=G9-INT-SIGNED-OPERATIONS&step=example`);
  const example = page.locator('.learning-worked-example');
  await expect(example).toContainText('A notebook costs R24.50. Find the cost of 3 notebooks.');
  await expect(page.getByRole('list', { name: 'Worked example reasoning', exact: true })).toHaveCount(0);
  await expect(example).toContainText('R73.50.');
});

test('lesson steps survive refresh, browser back and existing skill bookmarks', async ({ page }) => {
  await useScenario(page, 'practice');
  await page.goto(`/dashboard/student/learning/topic/${integers}#skill-G9-INT-SIGNED-OPERATIONS`);
  await expect(page.getByRole('heading', { name: 'Integer signs', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'See examples', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Worked example', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Integer signs', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Worked example', exact: true })).toBeVisible();
});

test('incorrect practice can revisit the example and retry the same saved question', async ({ page }) => {
  await useScenario(page, 'practice', {}, [{ status: 'incorrect', marksAwarded: 0, marksAvailable: 1, distractorExplanation: 'Check the direction of your move on the number line.' }]);
  await page.goto(`/dashboard/student/learning/activity/${activityCode}?topic=${integers}&skill=G9-INT-SIGNED-OPERATIONS&retentionCheck=review-test`);
  await page.getByRole('radio', { name: '−4', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Not quite yet' })).toBeFocused();
  await expect(page.getByText('Check the direction of your move on the number line.')).toBeVisible();
  await page.getByRole('link', { name: 'Review examples', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Worked example', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Try it yourself', exact: true }).click();
  await expect(page).toHaveURL(/retentionCheck=review-test/);
  await expect(page.getByText('Question 1 of 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Calculate: −6 + 10.' })).toBeVisible();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Answer correct', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to next step', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity complete', exact: true })).toBeVisible();
});

test('practice awaiting tutor review is not presented as correct', async ({ page }) => {
  await useScenario(page, 'practice', {}, [null]);
  await page.goto(`/dashboard/student/learning/activity/${activityCode}?topic=${integers}&skill=G9-INT-SIGNED-OPERATIONS`);
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved for review', exact: true })).toBeVisible();
  await expect(page.getByText('Marks awarded:', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Answer correct' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to next step', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity complete', exact: true })).toBeVisible();
});

test('practice disables answer and confidence controls while checking', async ({ page }) => {
  await useScenario(page, 'practice');
  let releaseAnswer = () => {};
  const pendingAnswer = new Promise<void>((resolve) => { releaseAnswer = resolve; });
  await page.route('**/functions/v1/evaluate-learning-attempt', async (route) => {
    await pendingAnswer;
    await route.fallback();
  });
  await page.goto(`/dashboard/student/learning/activity/${activityCode}`);
  await expect(page.getByRole('button', { name: 'Check answer', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  try {
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Checking answer...' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: '4', exact: true })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Very sure', exact: true })).toBeDisabled();
  } finally {
    releaseAnswer();
  }
  await expect(page.getByRole('heading', { name: 'Answer correct', exact: true })).toBeVisible();
});

test('completed practice continues to another unfinished lesson without recording mastery', async ({ page }) => {
  const firstSkill = { skillCode: 'G9-INT-SIGNED-OPERATIONS', skillName: 'Signed integer operations', activityCode, content: { title: 'Integer signs', explanation: 'Use a number line.', workedExample: '−8 + 13 = 5.' } };
  const secondSkill = { skillCode: 'G9-INT-ORDER', skillName: 'Ordering integers', activityCode: 'ACT.TEST.ORDER', content: { title: 'Put integers in order', explanation: 'Numbers increase from left to right.', workedExample: '−3 < 1 < 4.' } };
  await useScenario(page, 'practice', {
    get_my_grade9_learning_topic: { topicCode: integers, topicName: 'Integers', skills: [firstSkill, secondSkill] },
    get_my_grade9_term1_topic_learning_map: { topicCode: integers, topicName: 'Integers', skills: [firstSkill, secondSkill].map((skill, index) => ({ ...skill, lessonAvailable: true, practiceStatus: index === 0 ? 'completed' : 'not_started' })), baseline: { status: 'unavailable' }, endline: { status: 'unavailable' } },
  });
  await page.goto(`/dashboard/student/learning/activity/${activityCode}`);
  await expect(page.getByRole('link', { name: 'Integers', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to next step', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity complete', exact: true })).toBeVisible();
  await expect(page.getByText('Practice supports your learning. Topic mastery is recorded through formal assessments.')).toBeVisible();
  await page.getByRole('link', { name: 'Next lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Put integers in order', exact: true })).toBeVisible();
});

test('practice hints are disclosed without losing the selected answer', async ({ page }) => {
  await useScenario(page, 'practice', {
    get_learning_question_display: [{ question_version_id: 'question-1', prompt: 'Calculate: −6 + 10.', marks: 1, question_type: 'multiple_choice', options: [{ value: '4', label: '4' }, { value: '−4', label: '−4' }], hints: [{ id: 'hint-1', hint_level: 1, prompt: 'Start at −6, then move ten places to the right.' }] }],
  });
  await page.goto(`/dashboard/student/learning/activity/${activityCode}`);
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  await expect(page.getByText('Start at −6, then move ten places to the right.')).toBeVisible();
  await expect(page.getByRole('radio', { name: '4', exact: true })).toBeChecked();
});

test('a failed question request offers recovery instead of an endless loading state', async ({ page }) => {
  await useScenario(page, 'practice');
  let unavailable = true;
  let failedRequests = 0;
  let finishRetries = () => {};
  const retriesComplete = new Promise<void>((resolve) => { finishRetries = resolve; });
  await page.route('**/rest/v1/rpc/get_learning_question_display', async (route) => {
    if (!unavailable) return route.fallback();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Test-only unavailable question' }) });
    failedRequests += 1;
    if (failedRequests === 3) finishRetries();
  });
  await page.goto(`/dashboard/student/learning/activity/${activityCode}`);
  await retriesComplete;
  await expect(page.getByText('Question could not be loaded', { exact: true })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: /retry|try again/i }).click();
  await expect(page.getByRole('heading', { name: 'Calculate: −6 + 10.' })).toBeVisible();
});

for (const dark of [false, true]) {
  test(`topic lesson and practice accessibility across viewports — ${dark ? 'dark' : 'light'}`, async ({ page }, testInfo) => {
    await useScenario(page, 'practice');
    await page.goto(`/dashboard/student/learning/topic/${integers}`);
    await expect(page.getByRole('heading', { name: 'Your learning path', exact: true })).toBeVisible();
    await page.evaluate((enabled) => document.documentElement.classList.toggle('dark', enabled), dark);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    async function checkSurface(surface: string) {
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const violations = await page.evaluate(async () => {
          const { axe } = window as typeof window & { axe: { run: (context: string, options: { runOnly: string[] }) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } };
          return (await axe.run('.learning-overview', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations;
        });
        expect(violations, `${surface}, ${width}px`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`${surface}-${width}.png`), fullPage: true });
      }
    }
    await checkSurface('topic');
    await page.getByRole('link', { name: 'Continue lesson', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Integer signs', exact: true })).toBeVisible();
    await checkSurface('idea');
    await page.getByRole('link', { name: 'See examples', exact: true }).click();
    await checkSurface('example');
    await page.getByRole('link', { name: 'Try it yourself', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calculate: −6 + 10.' })).toBeVisible();
    await checkSurface('practice');
    await page.getByRole('radio', { name: '4', exact: true }).check();
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Answer correct' })).toBeVisible();
    await checkSurface('feedback');
    await page.getByRole('button', { name: 'Continue to next step', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Activity complete', exact: true })).toBeVisible();
    await checkSurface('complete');
  });
}

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
