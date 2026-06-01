import { optionalApiGet } from '../../lib/api/client';
import type { StudentDashboardView } from '../../types/lms';
import { loadStudentDashboard } from './studentDashboardRepository';

export interface StudentResultTopic {
  topic: string;
  subject?: string;
  score: number;
  support?: number;
}

export interface StudentResultItem {
  id: string;
  title: string;
  subject: string;
  grade?: string | null;
  score: number;
  total: number;
  percentage: number;
  levelBand?: string | null;
  markedAt?: string;
  completedAt?: string;
  submittedAt?: string;
  feedbackSummary?: string;
  topicBreakdown: StudentResultTopic[];
  recommendedNextSteps: string[];
}

export interface SubjectBreakdownItem {
  subject: string;
  score: number | null;
  marksObtained?: number | null;
  marksAvailable?: number | null;
  assessments: number;
}

export interface ClassDistributionBucket {
  range: string;
  count: number;
  isLearnerBucket?: boolean;
}

export interface StudentResultsAnalyticsView {
  items: StudentResultItem[];
  summary: {
    overallPercentage: number | null;
    totalMarksObtained: number | null;
    totalMarksAvailable: number | null;
    averageAcrossAssessments: number | null;
    currentAcademicStatus: string;
    classAverage: number | null;
    differenceFromClassAverage: number | null;
  };
  subjectBreakdown: SubjectBreakdownItem[];
  strengths: {
    subjects: SubjectBreakdownItem[];
    topics: StudentResultTopic[];
  };
  improvementAreas: {
    subjects: SubjectBreakdownItem[];
    topics: StudentResultTopic[];
  };
  classAnalytics: {
    available: boolean;
    privacyThreshold: number;
    overview: {
      classAverage: number | null;
      highestScore: number | null;
      lowestScore: number | null;
      passRate: number | null;
      numberOfLearners: number;
      assessmentCount: number;
    } | null;
    distribution: ClassDistributionBucket[];
    positioning: string;
    percentile?: number | null;
    differenceFromClassAverage?: number | null;
    trends: Array<{ period: string; average: number | null }>;
    subjectTrends: Array<{ subject: string; average: number | null; assessments: number }>;
  };
}

const emptyDistribution = ['0-29%', '30-39%', '40-49%', '50-59%', '60-69%', '70-79%', '80-100%']
  .map((range) => ({ range, count: 0 }));

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return Math.round((finite.reduce((total, value) => total + value, 0) / finite.length) * 10) / 10;
}

function academicStatus(score: number | null) {
  if (score == null) return 'Awaiting results';
  if (score >= 80) return 'Excellent progress';
  if (score >= 70) return 'Strong progress';
  if (score >= 50) return 'On track';
  if (score >= 40) return 'Needs support';
  return 'Urgent intervention';
}

function buildFallbackFromDashboard(data: StudentDashboardView): StudentResultsAnalyticsView {
  const marked = data.submissions.filter((submission) => submission.marks_awarded != null);
  const progressItems = data.progress.map<StudentResultItem>((item) => ({
    id: item.id,
    title: item.topic,
    subject: item.subject || 'General',
    score: Number(item.score),
    total: 100,
    percentage: Number(item.score),
    completedAt: item.recorded_at,
    markedAt: item.recorded_at,
    feedbackSummary: item.cognitive_level ? `Cognitive level: ${item.cognitive_level}` : 'Progress record captured.',
    topicBreakdown: [{ topic: item.topic, subject: item.subject || 'General', score: Number(item.score) }],
    recommendedNextSteps: [],
  }));
  const submissionItems = marked.map<StudentResultItem>((item) => ({
    id: item.id,
    title: item.assignment_id,
    subject: 'Assignment',
    score: Number(item.marks_awarded),
    total: 100,
    percentage: Number(item.marks_awarded),
    submittedAt: item.submitted_at || undefined,
    completedAt: item.submitted_at || undefined,
    markedAt: item.submitted_at || undefined,
    feedbackSummary: item.feedback || 'Marked assignment.',
    topicBreakdown: [],
    recommendedNextSteps: [],
  }));
  const items = [...submissionItems, ...progressItems];
  const overallPercentage = average(items.map((item) => item.percentage));
  const subjectMap = new Map<string, StudentResultItem[]>();
  for (const item of items) subjectMap.set(item.subject, [...(subjectMap.get(item.subject) || []), item]);
  const subjectBreakdown = [...subjectMap.entries()].map(([subject, subjectItems]) => ({
    subject,
    score: average(subjectItems.map((item) => item.percentage)),
    marksObtained: subjectItems.reduce((total, item) => total + item.score, 0),
    marksAvailable: subjectItems.reduce((total, item) => total + item.total, 0),
    assessments: subjectItems.length,
  })).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const topics = items.flatMap((item) => item.topicBreakdown);

  return {
    items,
    summary: {
      overallPercentage,
      totalMarksObtained: items.reduce((total, item) => total + item.score, 0),
      totalMarksAvailable: items.reduce((total, item) => total + item.total, 0),
      averageAcrossAssessments: overallPercentage,
      currentAcademicStatus: academicStatus(overallPercentage),
      classAverage: null,
      differenceFromClassAverage: null,
    },
    subjectBreakdown,
    strengths: {
      subjects: subjectBreakdown.slice(0, 3),
      topics: [...topics].sort((a, b) => b.score - a.score).slice(0, 5),
    },
    improvementAreas: {
      subjects: [...subjectBreakdown].sort((a, b) => Number(a.score ?? 0) - Number(b.score ?? 0)).slice(0, 3),
      topics: [...topics].sort((a, b) => a.score - b.score).slice(0, 5),
    },
    classAnalytics: {
      available: false,
      privacyThreshold: 3,
      overview: null,
      distribution: emptyDistribution,
      positioning: 'Anonymous class comparison is available once the results API has enough learners.',
      trends: [],
      subjectTrends: [],
    },
  };
}

export async function loadStudentResultsAnalytics(): Promise<StudentResultsAnalyticsView> {
  const apiView = await optionalApiGet<StudentResultsAnalyticsView | null>('/student/results', null);
  if (apiView?.summary && Array.isArray(apiView.items)) {
    return {
      ...apiView,
      classAnalytics: {
        ...apiView.classAnalytics,
        distribution: apiView.classAnalytics?.distribution?.length ? apiView.classAnalytics.distribution : emptyDistribution,
        trends: apiView.classAnalytics?.trends || [],
        subjectTrends: apiView.classAnalytics?.subjectTrends || [],
      },
    };
  }

  return buildFallbackFromDashboard(await loadStudentDashboard());
}
