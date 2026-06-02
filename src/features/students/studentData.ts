import type { Assignment, AssignmentSubmission, StudentDashboardView } from '../../types/lms';
import {
  calculateAssignmentStatus,
  getAssignmentPriority,
  parseDate,
  type AssignmentLifecycleStatus,
} from '../assignments/assignmentStatus';
import type { StudentResultItem } from './studentResultsRepository';

export type AssignmentItem = Assignment;
export type ResultsItem = StudentResultItem;

export interface TopicMastery {
  subject: string;
  topic: string;
  averageScore: number;
  assessmentCount: number;
  results: ResultsItem[];
}

export interface StudentTask {
  assignmentId: string;
  assignment: AssignmentItem;
  submission?: AssignmentSubmission;
  status: AssignmentLifecycleStatus;
  priority: number;
  dueAt: number;
}

export class PriorityQueue<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (left: T, right: T) => number) {}

  enqueue(item: T) {
    const index = this.items.findIndex((current) => this.compare(item, current) < 0);
    this.items.splice(index === -1 ? this.items.length : index, 0, item);
  }

  peek() {
    return this.items[0];
  }

  toArray() {
    return [...this.items];
  }

  get size() {
    return this.items.length;
  }
}

export interface NormalizedStudentData {
  assignmentsById: Map<string, AssignmentItem>;
  submissionsByAssignmentId: Map<string, AssignmentSubmission>;
  submittedAssignmentIds: Set<string>;
  assignmentBuckets: Map<string, AssignmentItem[]>;
  dueTasks: PriorityQueue<StudentTask>;
}

export interface NormalizedStudentResults {
  resultsById: Map<string, ResultsItem>;
  resultsBySubject: Map<string, ResultsItem[]>;
  topicMasteryByKey: Map<string, TopicMastery>;
}

const actionableStatuses = new Set<AssignmentLifecycleStatus>([
  'missing',
  'due_soon',
  'not_started',
  'returned_for_correction',
]);

function compareStudentTasks(left: StudentTask, right: StudentTask) {
  return left.priority - right.priority
    || left.dueAt - right.dueAt
    || left.assignmentId.localeCompare(right.assignmentId);
}

export function normalizeStudentData(
  data: Pick<StudentDashboardView, 'assignments' | 'submissions'>,
  now = new Date(),
): NormalizedStudentData {
  const assignmentsById = new Map<string, AssignmentItem>();
  const submissionsByAssignmentId = new Map<string, AssignmentSubmission>();
  const submittedAssignmentIds = new Set<string>();

  for (const assignment of data.assignments) {
    assignmentsById.set(assignment.id, assignment);
  }

  for (const submission of data.submissions) {
    submissionsByAssignmentId.set(submission.assignment_id, submission);
    submittedAssignmentIds.add(submission.assignment_id);
  }

  return {
    assignmentsById,
    submissionsByAssignmentId,
    submittedAssignmentIds,
    assignmentBuckets: selectAssignmentStatusBuckets(assignmentsById, submissionsByAssignmentId, now),
    dueTasks: selectDueTaskQueue(assignmentsById, submissionsByAssignmentId, now),
  };
}

export type AssignmentStatusBucket = 'due-now' | 'submitted' | 'marked' | 'archived';

export const assignmentStatusBucketOrder: AssignmentStatusBucket[] = ['due-now', 'submitted', 'marked', 'archived'];

export function selectAssignmentStatusBuckets(
  assignmentsById: Map<string, AssignmentItem>,
  submissionsByAssignmentId: Map<string, AssignmentSubmission>,
  now = new Date(),
) {
  const buckets = new Map<string, AssignmentItem[]>();
  for (const bucket of assignmentStatusBucketOrder) {
    buckets.set(bucket, []);
  }

  for (const assignment of assignmentsById.values()) {
    const submission = submissionsByAssignmentId.get(assignment.id);
    const status = calculateAssignmentStatus({ assignment, submission, now });
    const bucket = getAssignmentStatusBucket(status);
    buckets.set(bucket, [...(buckets.get(bucket) || []), assignment]);
  }

  // Keep each tab deterministic: most urgent items first, then due date, then title.
  for (const [bucket, items] of buckets) {
    buckets.set(bucket, [...items].sort((left, right) => compareAssignmentsForBucket(left, right, submissionsByAssignmentId, now)));
  }

  return buckets;
}

export function getAssignmentStatusBucket(status: AssignmentLifecycleStatus): AssignmentStatusBucket {
  if (status === 'archived' || status === 'closed' || status === 'draft') {
    return 'archived';
  }
  if (status === 'marked') {
    return 'marked';
  }
  if (status === 'submitted' || status === 'under_review' || status === 'late_submitted') {
    return 'submitted';
  }
  return 'due-now';
}

function compareAssignmentsForBucket(
  left: AssignmentItem,
  right: AssignmentItem,
  submissionsByAssignmentId: Map<string, AssignmentSubmission>,
  now: Date,
) {
  const leftStatus = calculateAssignmentStatus({ assignment: left, submission: submissionsByAssignmentId.get(left.id), now });
  const rightStatus = calculateAssignmentStatus({ assignment: right, submission: submissionsByAssignmentId.get(right.id), now });
  const priorityDelta = getAssignmentPriority(leftStatus) - getAssignmentPriority(rightStatus);
  if (priorityDelta !== 0) return priorityDelta;

  const dueDelta = (parseDate(left.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER)
    - (parseDate(right.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER);
  if (dueDelta !== 0) return dueDelta;

  return left.title.localeCompare(right.title);
}

export function selectDueTaskQueue(
  assignmentsById: Map<string, AssignmentItem>,
  submissionsByAssignmentId: Map<string, AssignmentSubmission>,
  now = new Date(),
) {
  const queue = new PriorityQueue<StudentTask>(compareStudentTasks);

  for (const assignment of assignmentsById.values()) {
    const submission = submissionsByAssignmentId.get(assignment.id);
    const status = calculateAssignmentStatus({ assignment, submission, now });
    if (!actionableStatuses.has(status)) {
      continue;
    }

    queue.enqueue({
      assignmentId: assignment.id,
      assignment,
      submission,
      status,
      priority: getAssignmentPriority(status),
      dueAt: parseDate(assignment.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  return queue;
}

export function selectDueTasks(data: NormalizedStudentData, limit?: number) {
  const tasks = data.dueTasks.toArray();
  return limit === undefined ? tasks : tasks.slice(0, limit);
}

export function selectCompletionRate(data: NormalizedStudentData) {
  return data.assignmentsById.size
    ? Math.round((data.submittedAssignmentIds.size / data.assignmentsById.size) * 100)
    : 0;
}

export function normalizeStudentResults(items: ResultsItem[]): NormalizedStudentResults {
  const resultsById = new Map<string, ResultsItem>();
  const resultsBySubject = new Map<string, ResultsItem[]>();
  const topicMasteryByKey = new Map<string, TopicMastery>();

  for (const item of items) {
    resultsById.set(item.id, item);
    resultsBySubject.set(item.subject, [...(resultsBySubject.get(item.subject) || []), item]);

    const topics = item.topicBreakdown.length
      ? item.topicBreakdown
      : [{ subject: item.subject, topic: item.title, score: item.percentage }];

    for (const topic of topics) {
      const subject = topic.subject || item.subject;
      const key = `${subject}::${topic.topic}`;
      const current = topicMasteryByKey.get(key);
      const assessmentCount = (current?.assessmentCount || 0) + 1;
      const scoreTotal = (current?.averageScore || 0) * (current?.assessmentCount || 0) + Number(topic.score || 0);

      topicMasteryByKey.set(key, {
        subject,
        topic: topic.topic,
        averageScore: Math.round((scoreTotal / assessmentCount) * 10) / 10,
        assessmentCount,
        results: [...(current?.results || []), item],
      });
    }
  }

  return { resultsById, resultsBySubject, topicMasteryByKey };
}

export function selectResultSubjects(data: NormalizedStudentResults) {
  return ['all', ...data.resultsBySubject.keys()];
}

export function selectResults(
  data: NormalizedStudentResults,
  options: { subject?: string; query?: string; sort?: 'date' | 'percentage' | 'subject' } = {},
) {
  const subject = options.subject || 'all';
  const query = options.query?.trim().toLowerCase() || '';
  const sort = options.sort || 'date';

  return [...data.resultsById.values()]
    .filter((item) => subject === 'all' || item.subject === subject)
    .filter((item) => !query || [item.title, item.subject, item.feedbackSummary]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((left, right) => {
      if (sort === 'percentage') return right.percentage - left.percentage;
      if (sort === 'subject') return left.subject.localeCompare(right.subject) || left.title.localeCompare(right.title);
      return new Date(right.completedAt || right.markedAt || 0).getTime() - new Date(left.completedAt || left.markedAt || 0).getTime();
    });
}
