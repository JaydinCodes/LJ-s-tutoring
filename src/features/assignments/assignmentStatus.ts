import type { Assignment, AssignmentSubmission } from '../../types/lms';

export type AssignmentLifecycleStatus =
  | 'not_started'
  | 'due_soon'
  | 'submitted'
  | 'late_submitted'
  | 'under_review'
  | 'marked'
  | 'returned_for_correction'
  | 'missing'
  | 'closed'
  | 'draft'
  | 'archived';

export interface AssignmentStatusInput {
  assignment: Pick<Assignment, 'status' | 'due_date'>;
  submission?: Pick<AssignmentSubmission, 'status' | 'submitted_at' | 'marks_awarded' | 'feedback'> | null;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysUntil(value?: string | null, now = new Date()) {
  const date = parseDate(value);
  if (!date) {
    return null;
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.ceil((startOfDueDate - startOfToday) / DAY_MS);
}

export function calculateAssignmentStatus({
  assignment,
  submission,
  now = new Date(),
}: AssignmentStatusInput): AssignmentLifecycleStatus {
  const assignmentStatus = String(assignment.status || '').toLowerCase();
  const submissionStatus = String(submission?.status || '').toLowerCase();
  const dueInDays = daysUntil(assignment.due_date, now);
  const isOverdue = dueInDays !== null && dueInDays < 0;

  if (assignmentStatus === 'draft') {
    return 'draft';
  }
  if (assignmentStatus === 'archived') {
    return 'archived';
  }
  if (assignmentStatus === 'closed' || assignmentStatus === 'cancelled') {
    return submission ? normalizeSubmissionStatus(submissionStatus, submission, isOverdue) : 'closed';
  }

  if (!submission) {
    if (isOverdue) {
      return 'missing';
    }
    return dueInDays !== null && dueInDays <= 3 ? 'due_soon' : 'not_started';
  }

  return normalizeSubmissionStatus(submissionStatus, submission, isOverdue);
}

function normalizeSubmissionStatus(
  submissionStatus: string,
  submission: Pick<AssignmentSubmission, 'marks_awarded'>,
  isOverdue: boolean,
): AssignmentLifecycleStatus {
  if (submissionStatus === 'returned' || submissionStatus === 'returned_for_correction') {
    return 'returned_for_correction';
  }
  if (submissionStatus === 'marked' || submissionStatus === 'reviewed' || submission.marks_awarded != null) {
    return 'marked';
  }
  if (submissionStatus === 'late' || submissionStatus === 'late_submitted') {
    return 'late_submitted';
  }
  if (submissionStatus === 'under_review') {
    return 'under_review';
  }
  if (submissionStatus === 'submitted') {
    return isOverdue ? 'late_submitted' : 'under_review';
  }
  return isOverdue ? 'late_submitted' : 'submitted';
}

export function getAssignmentStatusLabel(status: AssignmentLifecycleStatus) {
  const labels: Record<AssignmentLifecycleStatus, string> = {
    not_started: 'Not started',
    due_soon: 'Due soon',
    submitted: 'Submitted',
    late_submitted: 'Late submitted',
    under_review: 'Under review',
    marked: 'Marked',
    returned_for_correction: 'Returned for correction',
    missing: 'Missing',
    closed: 'Closed',
    draft: 'Draft',
    archived: 'Archived',
  };
  return labels[status];
}

export function getAssignmentStatusVariant(status: AssignmentLifecycleStatus) {
  if (status === 'marked') {
    return 'success';
  }
  if (status === 'due_soon' || status === 'submitted' || status === 'under_review') {
    return 'info';
  }
  if (status === 'not_started' || status === 'draft' || status === 'closed' || status === 'archived') {
    return 'neutral';
  }
  if (status === 'late_submitted' || status === 'returned_for_correction') {
    return 'warning';
  }
  return 'danger';
}

export function getAssignmentPriority(status: AssignmentLifecycleStatus) {
  const order: Record<AssignmentLifecycleStatus, number> = {
    missing: 0,
    due_soon: 1,
    not_started: 2,
    returned_for_correction: 3,
    under_review: 4,
    submitted: 5,
    late_submitted: 6,
    marked: 7,
    closed: 8,
    draft: 9,
    archived: 10,
  };
  return order[status];
}

export function sortAssignmentsByPriority(
  assignments: Assignment[],
  submissionsByAssignment: Map<string, AssignmentSubmission>,
  now = new Date(),
) {
  return [...assignments].sort((a, b) => {
    const statusA = calculateAssignmentStatus({ assignment: a, submission: submissionsByAssignment.get(a.id), now });
    const statusB = calculateAssignmentStatus({ assignment: b, submission: submissionsByAssignment.get(b.id), now });
    const priorityDelta = getAssignmentPriority(statusA) - getAssignmentPriority(statusB);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const dueA = parseDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dueB = parseDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return dueA - dueB;
  });
}
