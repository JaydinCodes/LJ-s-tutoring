import { expect, test, type Page } from '@playwright/test';

const topicCode = 'G9-T1-WHOLE-NUMBERS';
const skills = [
  ['G9-NUM-REAL-IRRATIONAL', 'Understanding number families'],
  ['G9-NUM-WHOLE-HCF-LCM', 'Factors, prime factors, HCF and LCM'],
  ['G9-NUM-RATIO-RATE', 'Ratios and rates'],
  ['G9-NUM-DIRECT-INVERSE-PROPORTION', 'Direct and inverse proportion'],
  ['G9-NUM-FINANCIAL-APPLICATIONS', 'Financial mathematics'],
] as const;

async function useWholeNumbersStudio(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('project-odysseus:e2e-auth', JSON.stringify({ role: 'student', email: 'studio.e2e@projectodysseus.test' })));
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const rpc = route.request().url().split('/').pop() ?? '';
    const input = route.request().postDataJSON() as { p_topic_code?: string } | null;
    const lessonSkills = skills.map(([skillCode, skillName], index) => ({
      skillCode, skillName, skillDescription: `Test-only reviewed ${skillName} content.`, activityCode: `ACT.STUDIO.${index + 1}`,
      content: { title: skillName, learningObjective: 'Explore the visual before independent practice.', explanation: 'Reviewed test-only content.', workedExample: 'Reviewed test-only example.' },
    }));
    const topic = { topicCode: input?.p_topic_code ?? topicCode, topicName: 'Whole Numbers', topicDescription: 'Test-only studio content.', areaName: 'Numbers', skills: lessonSkills };
    const map = { topicCode, topicName: 'Whole Numbers', skills: lessonSkills.map((skill) => ({ ...skill, lessonAvailable: true, practiceStatus: 'not_started', practiceAttempted: false, skillEvidenceState: null, skillEvidenceAt: null })), baseline: { status: 'unavailable' }, endline: { status: 'unavailable' } };
    const journey = { primary: { action: 'explore_topic', topicCode: null, title: 'Choose a topic', description: 'Test-only', route: '/dashboard/student/learning', reasonCodes: [] }, topics: [{ topicCode, topicName: 'Whole Numbers', status: 'learning_in_progress', topicMasteryStatus: null, reasonCodes: [], lastUpdatedAt: '2026-11-23T00:00:00.000Z', contentAvailable: true, availableAssessmentTypes: [], focusSkillCode: null }], currentTopic: null, alternatives: [], prerequisiteRecommendation: null, lastProgressAt: '2026-11-23T00:00:00.000Z', contentAvailable: true, context: {} };
    const answers: Record<string, unknown> = {
      get_my_grade9_learning_topic: topic,
      get_my_grade9_term1_topic_learning_map: map,
      get_my_grade9_term1_learning_journey: journey,
      get_my_approved_learning_video_resources: [],
      set_my_grade9_term1_learning_context: null,
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answers[rpc] ?? null) });
  });
}

test('Whole Numbers studio is responsive and exposes each principal mathematical scene', async ({ page }, testInfo) => {
  await useWholeNumbersStudio(page);
  const routes = [
    ['number-families', 'G9-NUM-REAL-IRRATIONAL'],
    ['factors', 'G9-NUM-WHOLE-HCF-LCM&discovery=factors'],
    ['prime-factorisation', 'G9-NUM-WHOLE-HCF-LCM&discovery=prime-factorisation'],
    ['hcf-lcm', 'G9-NUM-WHOLE-HCF-LCM'],
    ['proportion', 'G9-NUM-RATIO-RATE'],
    ['financial', 'G9-NUM-FINANCIAL-APPLICATIONS'],
  ];

  for (const [scene, lesson] of routes) {
    await page.goto(`/dashboard/student/learning/topic/${topicCode}?lesson=${lesson}`);
    const studio = page.getByRole('region', { name: /interactive mathematics stage/i });
    await expect(studio).toBeVisible();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await studio.screenshot({ path: testInfo.outputPath(`whole-numbers-studio/${scene}-${width}.png`) });
      if (width === 1440) await page.screenshot({ path: testInfo.outputPath(`whole-numbers-studio/${scene}-full-page.png`), fullPage: true });
    }
  }
});
