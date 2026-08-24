import type { CareerProgramme, CareerSummary, CareerSubjectRequirement } from './studentCareersRepository';

export const APS_REQUIRED_SUBJECT_COUNT = 6;
export const APS_MAXIMUM = 42;
export const APS_TARGET_MAXIMUM = 60;

export type SubjectEvidence = {
  subject: string;
  score: number | null;
  assessments?: number;
};

export type ApsSubject = {
  subject: string;
  percentage: number;
  points: number;
};

export type ApsSummary = {
  current: number | null;
  enoughResults: boolean;
  included: ApsSubject[];
  excluded: string[];
  missingCount: number;
};

export type EligibilityKind = 'appears-eligible' | 'close' | 'requirements-to-check' | 'missing-results' | 'not-currently-eligible';

export type ProgrammeEligibility = {
  programme: CareerProgramme;
  kind: EligibilityKind;
  label: 'Appears eligible' | 'Close' | 'Requirements to check' | 'Missing results' | 'Not currently eligible';
  explanation: string;
  apsComparison: string;
  requirements: CareerSubjectRequirement[];
  gaps: string[];
};

export type ImprovementAction = {
  id: string;
  title: string;
  evidence: string;
  why: string;
  action: string;
  href?: string;
  sourceUrl?: string;
};

function normalizeSubject(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function normalizeApsTarget(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.min(APS_TARGET_MAXIMUM, Math.round(Number(value))));
}

export function percentageToApsPoints(value: number) {
  const score = clampPercentage(value);
  if (score >= 80) return 7;
  if (score >= 70) return 6;
  if (score >= 60) return 5;
  if (score >= 50) return 4;
  if (score >= 40) return 3;
  if (score >= 30) return 2;
  return 1;
}

// Careers uses this one APS rule everywhere: six strongest distinct, released
// subject averages, excluding Life Orientation. Institution-specific methods
// still need checking on the linked programme source.
export function calculateGuidanceAps(subjects: SubjectEvidence[]): ApsSummary {
  const bySubject = new Map<string, { label: string; values: number[] }>();
  const excluded = new Set<string>();

  for (const item of subjects) {
    const key = normalizeSubject(item.subject || '');
    const numeric = item.score == null ? Number.NaN : Number(item.score);
    if (!key || !Number.isFinite(numeric)) {
      if (item.subject) excluded.add(item.subject);
      continue;
    }
    if (key === 'life orientation') {
      excluded.add(item.subject);
      continue;
    }
    const current = bySubject.get(key) ?? { label: item.subject, values: [] };
    current.values.push(clampPercentage(numeric));
    bySubject.set(key, current);
  }

  const available = [...bySubject.values()]
    .map((item) => {
      const percentage = Math.round((item.values.reduce((sum, value) => sum + value, 0) / item.values.length) * 10) / 10;
      return { subject: item.label, percentage, points: percentageToApsPoints(percentage) };
    })
    .sort((left, right) => right.points - left.points || right.percentage - left.percentage || left.subject.localeCompare(right.subject));
  const included = available.slice(0, APS_REQUIRED_SUBJECT_COUNT);
  for (const item of available.slice(APS_REQUIRED_SUBJECT_COUNT)) excluded.add(item.subject);
  const enoughResults = included.length === APS_REQUIRED_SUBJECT_COUNT;

  return {
    current: enoughResults ? Math.min(APS_MAXIMUM, included.reduce((sum, item) => sum + item.points, 0)) : null,
    enoughResults,
    included,
    excluded: [...excluded],
    missingCount: Math.max(0, APS_REQUIRED_SUBJECT_COUNT - included.length),
  };
}

function resultForRequirement(requirement: CareerSubjectRequirement, subjects: SubjectEvidence[]) {
  const accepted = new Set(requirement.acceptedSubjects.map(normalizeSubject));
  return subjects.find((subject) => accepted.has(normalizeSubject(subject.subject)) && subject.score != null && Number.isFinite(Number(subject.score)));
}

export function programmeRequirements(programme: CareerProgramme) {
  const requirements = [...(programme.requirements?.subjectRequirements ?? [])];
  const englishMinimum = programme.requirements?.minimumEnglishPercentage;
  const hasEnglish = requirements.some((requirement) => requirement.acceptedSubjects.some((subject) => normalizeSubject(subject) === 'english'));
  if (englishMinimum != null && !hasEnglish) {
    requirements.push({ label: 'English', acceptedSubjects: ['English'], minimumPercentage: englishMinimum });
  }
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    const key = [...requirement.acceptedSubjects].map(normalizeSubject).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classifyProgramme(programme: CareerProgramme, aps: ApsSummary, subjects: SubjectEvidence[]): ProgrammeEligibility {
  const requirements = programmeRequirements(programme);
  const minimumAps = programme.requirements?.minimumAps;
  const hasStructuredRequirements = minimumAps != null || requirements.length > 0;
  const missing = requirements.filter((requirement) => !resultForRequirement(requirement, subjects));
  const subjectGaps = requirements.flatMap((requirement) => {
    const result = resultForRequirement(requirement, subjects);
    if (!result || result.score == null) return [];
    const gap = Math.max(0, Math.ceil(requirement.minimumPercentage - clampPercentage(Number(result.score))));
    return gap > 0 ? [`${requirement.label} is ${gap} percentage point${gap === 1 ? '' : 's'} below the listed minimum.`] : [];
  });
  const apsGap = minimumAps != null && aps.current != null ? Math.max(0, minimumAps - aps.current) : 0;
  const gaps = [
    ...(minimumAps != null && aps.current == null ? ['A guidance APS cannot be calculated from the available released subjects.'] : []),
    ...missing.map((requirement) => `${requirement.label} result is missing.`),
    ...(apsGap > 0 ? [`Guidance APS is ${apsGap} point${apsGap === 1 ? '' : 's'} below the listed minimum.`] : []),
    ...subjectGaps,
  ];
  const apsComparison = minimumAps == null
    ? 'APS requirement not recorded'
    : aps.current == null
      ? `Listed APS ${minimumAps}; current APS unavailable`
      : `Guidance APS ${aps.current} / listed ${minimumAps}`;

  if (!hasStructuredRequirements) {
    return { programme, kind: 'requirements-to-check', label: 'Requirements to check', explanation: 'The catalogue does not contain enough structured entry requirements for this programme. Check the institution source before planning.', apsComparison, requirements, gaps };
  }
  if ((minimumAps != null && aps.current == null) || missing.length > 0) {
    const labels = [...(minimumAps != null && aps.current == null ? ['enough released subjects for APS'] : []), ...missing.map((item) => item.label)];
    return { programme, kind: 'missing-results', label: 'Missing results', explanation: `Missing results — add ${labels.join(' and ')} before comparing this programme. Missing data is not a negative eligibility decision.`, apsComparison, requirements, gaps };
  }
  const largestSubjectGap = Math.max(0, ...subjectGaps.map((gap) => Number(gap.match(/\d+/)?.[0] ?? 0)));
  if (apsGap === 0 && subjectGaps.length === 0) {
    return { programme, kind: 'appears-eligible', label: 'Appears eligible', explanation: 'Appears eligible — your guidance APS and recorded subject results meet the listed minimums. The institution still makes the admission decision.', apsComparison, requirements, gaps };
  }
  if (apsGap <= 3 && largestSubjectGap <= 5) {
    const reason = apsGap > 0 ? `your guidance APS is within ${apsGap} point${apsGap === 1 ? '' : 's'}` : 'your APS meets the listed minimum';
    return { programme, kind: 'close', label: 'Close', explanation: `Close — ${reason}, but ${subjectGaps[0] ?? 'a programme requirement still needs attention'}`, apsComparison, requirements, gaps };
  }
  return { programme, kind: 'not-currently-eligible', label: 'Not currently eligible', explanation: `Not currently eligible from the available evidence — ${gaps[0] ?? 'one or more listed minimums are not met'}`, apsComparison, requirements, gaps };
}

export function deriveImprovementActions(
  career: CareerSummary,
  eligibility: ProgrammeEligibility[],
  aps: ApsSummary,
  targetAps: number | null,
): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  if (!aps.enoughResults) {
    actions.push({
      id: 'add-results',
      title: `Add ${aps.missingCount} more subject result${aps.missingCount === 1 ? '' : 's'}`,
      evidence: `Only ${aps.included.length} valid non–Life Orientation subject average${aps.included.length === 1 ? ' is' : 's are'} available.`,
      why: 'Six released subject averages are needed for the Careers guidance APS.',
      action: 'Review results',
      href: '/dashboard/student/results',
    });
  } else if (targetAps != null && aps.current != null && aps.current < targetAps) {
    const gap = targetAps - aps.current;
    actions.push({ id: 'aps-gap', title: `Improve guidance APS by ${gap} point${gap === 1 ? '' : 's'}`, evidence: `Current ${aps.current}; saved target ${targetAps}.`, why: `Closing the saved target gap supports comparison for ${career.title}.`, action: 'Review subject results', href: '/dashboard/student/results' });
  }

  const firstGap = eligibility.find((item) => item.gaps.length > 0);
  if (firstGap) {
    actions.push({ id: `programme-gap-${firstGap.programme.id}`, title: `Address the next ${firstGap.programme.programmeName} gap`, evidence: firstGap.gaps[0], why: `This is a listed requirement for a programme aligned with ${career.title}.`, action: firstGap.programme.sourceUrl ? 'Verify requirement' : 'Review evidence', sourceUrl: firstGap.programme.sourceUrl, href: firstGap.programme.sourceUrl ? undefined : '/dashboard/student/results' });
  }

  const unverified = eligibility.find((item) => item.kind === 'requirements-to-check' || item.programme.requirementConfidence !== 'high');
  if (unverified) {
    actions.push({ id: `verify-${unverified.programme.id}`, title: 'Confirm institution-specific requirements', evidence: `${unverified.programme.institutionName} is marked ${unverified.programme.requirementConfidence ?? 'without'} confidence and has no stored update date.`, why: 'Programme rules can change by intake, faculty and qualification.', action: 'Open official source', sourceUrl: unverified.programme.sourceUrl });
  }

  return actions.slice(0, 3);
}

export function careerProgrammes(programmes: CareerProgramme[], careerId: string) {
  return programmes.filter((programme) => programme.alignedCareerIds.includes(careerId));
}
