import type { StudentDashboardView } from '../../types/lms';
import { daysUntil } from '../assignments/assignmentStatus';
import { selectDueTasks, type NormalizedStudentData, type StudentTask } from './studentData';

export type BattlePlanKind = 'assignment' | 'exam' | 'topic' | 'quiz' | 'career';

export interface BattlePlanItem {
  id: string;
  kind: BattlePlanKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  to: string;
  priority: number;
}

const MAX_BATTLE_PLAN_ITEMS = 5;
const MIN_BATTLE_PLAN_ITEMS = 3;

function assignmentDescription(task: StudentTask, dueInDays: number | null) {
  if (dueInDays != null && dueInDays < 0) {
    return `${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? '' : 's'} overdue. Submit the clearest next version before adding new work.`;
  }
  if (dueInDays === 0) {
    return 'Due today. Finish the upload or written answer before moving to revision.';
  }
  return `Due ${task.assignment.due_date || 'soon'}. Use this as your next assignment block.`;
}

function assignmentItem(task: StudentTask, priority: number, dueInDays: number | null): BattlePlanItem {
  return {
    id: `assignment:${task.assignmentId}`,
    kind: 'assignment',
    title: task.assignment.title,
    description: assignmentDescription(task, dueInDays),
    estimatedMinutes: dueInDays != null && dueInDays < 0 ? 45 : 30,
    to: `/dashboard/student/assignments/${task.assignmentId}`,
    priority,
  };
}

function addUnique(items: BattlePlanItem[], item: BattlePlanItem | null) {
  if (!item || items.some((current) => current.id === item.id)) {
    return;
  }
  items.push(item);
}

export function selectTodayBattlePlan(
  data: StudentDashboardView,
  studentData: NormalizedStudentData,
  now = new Date(),
): BattlePlanItem[] {
  const candidates: BattlePlanItem[] = [];
  const dueTasks = selectDueTasks(studentData);

  // Priority order mirrors the product rule: assignments, exams, progress, quiz, then study/career action.
  for (const task of dueTasks) {
    const dueInDays = daysUntil(task.assignment.due_date, now);
    if (dueInDays != null && dueInDays < 0) {
      addUnique(candidates, assignmentItem(task, 10, dueInDays));
    }
  }

  for (const task of dueTasks) {
    const dueInDays = daysUntil(task.assignment.due_date, now);
    if (dueInDays === 0) {
      addUnique(candidates, assignmentItem(task, 20, dueInDays));
    }
  }

  const nextExam = data.examCalendar?.nextExam;
  const nextExamDays = daysUntil(nextExam?.examDate, now);
  if (nextExam && nextExamDays != null && nextExamDays >= 0) {
    addUnique(candidates, {
      id: `exam:${nextExam.id}`,
      kind: 'exam',
      title: `${nextExam.subject} exam prep`,
      description: `${nextExam.title} is in ${nextExamDays} day${nextExamDays === 1 ? '' : 's'}. Review one weak area, then do exam-style practice.`,
      estimatedMinutes: nextExamDays <= 7 ? 45 : 30,
      to: '/dashboard/student/progress',
      priority: 30 + Math.min(nextExamDays, 21),
    });
  }

  const weakestTopic = data.progress
    .filter((item) => Number.isFinite(Number(item.score)))
    .sort((left, right) => Number(left.score) - Number(right.score) || left.topic.localeCompare(right.topic))[0];
  if (weakestTopic) {
    addUnique(candidates, {
      id: `topic:${weakestTopic.id}`,
      kind: 'topic',
      title: `Strengthen ${weakestTopic.topic}`,
      description: `${weakestTopic.score}% mastery. Review one worked example, then solve one similar question independently.`,
      estimatedMinutes: 25,
      to: '/dashboard/student/progress',
      priority: 40 + Math.max(0, Math.min(100, Number(weakestTopic.score))),
    });
  }

  if (data.recommendedQuiz) {
    addUnique(candidates, {
      id: `quiz:${data.recommendedQuiz.id}`,
      kind: 'quiz',
      title: data.recommendedQuiz.title,
      description: `Quick check for ${data.recommendedQuiz.topic}. Use it to confirm what stuck after revision.`,
      estimatedMinutes: data.recommendedQuiz.estimatedMinutes || 12,
      to: '/dashboard/student/progress',
      priority: 50,
    });
  }

  const careerGoal = data.careerGoals?.[0];
  const recommendation = data.recommendedNext;
  addUnique(candidates, recommendation ? {
    id: careerGoal ? `career:${careerGoal.goalId}` : 'study:recommended-next',
    kind: careerGoal ? 'career' : 'topic',
    title: recommendation.title,
    description: recommendation.description,
    estimatedMinutes: 20,
    to: careerGoal ? '/dashboard/student/careers' : '/dashboard/student/progress',
    priority: 60,
  } : {
    id: 'study:daily-focus',
    kind: 'career',
    title: 'Set up one focused study block',
    description: data.supportStatus?.recommendedAction || 'Use the next 20 minutes to complete one concrete learning step.',
    estimatedMinutes: 20,
    to: '/dashboard/student/progress',
    priority: 65,
  });

  const fallbackActions: BattlePlanItem[] = [
    {
      id: 'study:assignment-check',
      kind: 'assignment',
      title: 'Check the assignment queue',
      description: `${studentData.assignmentsById.size} visible assignment${studentData.assignmentsById.size === 1 ? '' : 's'} are connected to this dashboard.`,
      estimatedMinutes: 10,
      to: '/dashboard/student/assignments',
      priority: 70,
    },
    {
      id: 'study:progress-review',
      kind: 'topic',
      title: 'Review progress signals',
      description: `${data.progress.length} progress record${data.progress.length === 1 ? '' : 's'} can guide the next practice block.`,
      estimatedMinutes: 15,
      to: '/dashboard/student/progress',
      priority: 71,
    },
  ];

  for (const item of fallbackActions) {
    if (candidates.length >= MIN_BATTLE_PLAN_ITEMS) {
      break;
    }
    addUnique(candidates, item);
  }

  return candidates
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title))
    .slice(0, MAX_BATTLE_PLAN_ITEMS);
}

export function sortBattlePlanForDisplay(items: BattlePlanItem[], completedIds: Set<string>) {
  return [...items].sort((left, right) => {
    const leftDone = completedIds.has(left.id);
    const rightDone = completedIds.has(right.id);
    if (leftDone !== rightDone) {
      return leftDone ? 1 : -1;
    }
    return left.priority - right.priority || left.title.localeCompare(right.title);
  });
}
