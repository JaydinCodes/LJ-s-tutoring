import type { StudentDashboardView } from '../../types/lms';
import { daysUntil } from '../assignments/assignmentStatus';
import { selectDueTasks, type NormalizedStudentData } from './studentData';

export type DailyInsightTone = 'steady' | 'momentum' | 'focus' | 'revision' | 'urgent';

export type DailyInsightInput = {
  studentId: string;
  today: string;
  overdueCount: number;
  assignmentPressure: number;
  nextExamDays?: number;
  weakestTopic?: string;
  weakestTopicScore?: number;
  averageScore?: number;
  attendanceRate?: number;
  streakDays?: number;
};

export type DailyInsight = {
  seed: string;
  tone: DailyInsightTone;
  eyebrow: string;
  message: string;
  action: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDailyInsightSeed(input: DailyInsightInput) {
  return `${input.studentId}:${input.today}`;
}

// Local calendar dates keep the daily card stable for the learner's whole day.
export function formatDailyInsightDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hash(value: string) {
  let total = 0;
  for (const character of value) {
    total = (total * 31 + character.charCodeAt(0)) >>> 0;
  }
  return total;
}

function dailyIndex(input: DailyInsightInput, optionCount: number) {
  const dayNumber = Math.floor(Date.parse(`${input.today}T00:00:00Z`) / DAY_MS);
  const rotation = Number.isFinite(dayNumber) ? dayNumber : hash(input.today);
  return (hash(input.studentId) + rotation) % optionCount;
}

function chooseDaily(input: DailyInsightInput, options: string[]) {
  return options[dailyIndex(input, options.length)];
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : undefined;
}

export function selectDailyInsightInput(
  data: StudentDashboardView,
  studentData: NormalizedStudentData,
  now = new Date(),
): DailyInsightInput {
  const dueTasks = selectDueTasks(studentData);
  const topicScores = data.progress
    .filter((item) => Number.isFinite(Number(item.score)))
    .map((item) => ({ topic: item.topic, score: Number(item.score) }))
    .sort((left, right) => left.score - right.score || left.topic.localeCompare(right.topic));
  const context = data.dailyInsightContext;
  const nextExamDays = daysUntil(context?.nextExamDate, now);

  return {
    studentId: context?.studentId || 'current',
    today: formatDailyInsightDate(now),
    overdueCount: dueTasks.filter((task) => task.status === 'missing').length,
    assignmentPressure: dueTasks.length,
    nextExamDays: nextExamDays == null ? undefined : nextExamDays,
    weakestTopic: topicScores[0]?.topic,
    weakestTopicScore: topicScores[0]?.score,
    averageScore: context?.averageScore ?? average(topicScores.map((item) => item.score)),
    attendanceRate: context?.attendanceRate,
    streakDays: context?.streakDays,
  };
}

export function getDailyInsight(input: DailyInsightInput): DailyInsight {
  const seed = getDailyInsightSeed(input);
  const weakTopic = input.weakestTopic || 'your priority topic';

  if (input.overdueCount > 0) {
    return {
      seed,
      tone: 'urgent',
      eyebrow: 'Catch-up focus',
      message: chooseDaily(input, [
        `You have ${input.overdueCount} overdue assignment${input.overdueCount === 1 ? '' : 's'}. Start with the oldest one, then use a short ${weakTopic} review block to rebuild momentum.`,
        `${input.overdueCount} overdue assignment${input.overdueCount === 1 ? ' needs' : 's need'} attention today. Finish one clear step first and keep the plan manageable.`,
        `Today is a catch-up day: ${input.overdueCount} overdue assignment${input.overdueCount === 1 ? '' : 's'} remain. Submit the most urgent item before adding new work.`,
      ]),
      action: 'Open the highest-priority overdue assignment and complete the next concrete step.',
    };
  }

  if (input.nextExamDays != null && input.nextExamDays >= 0 && input.nextExamDays <= 21) {
    return {
      seed,
      tone: 'revision',
      eyebrow: 'Revision mode',
      message: chooseDaily(input, [
        `Your next exam is in ${input.nextExamDays} day${input.nextExamDays === 1 ? '' : 's'}. Put ${weakTopic} at the centre of today's revision plan.`,
        `Exam preparation leads today: ${input.nextExamDays} day${input.nextExamDays === 1 ? '' : 's'} remain. Revise ${weakTopic}, then check your recall without notes.`,
        `With ${input.nextExamDays} day${input.nextExamDays === 1 ? '' : 's'} until your next exam, use a focused ${weakTopic} block and finish with exam-style practice.`,
      ]),
      action: `Schedule one timed ${weakTopic} revision block before starting lower-priority work.`,
    };
  }

  if (input.assignmentPressure >= 3) {
    return {
      seed,
      tone: 'focus',
      eyebrow: 'Plan the workload',
      message: chooseDaily(input, [
        `${input.assignmentPressure} assignments need action. Work in due-date order and protect time for ${weakTopic}.`,
        `Your queue has ${input.assignmentPressure} active assignments. Complete the next due task first, then review ${weakTopic}.`,
        `There are ${input.assignmentPressure} assignments on your active list. Keep today focused: one submission step, then one ${weakTopic} practice block.`,
      ]),
      action: 'Use the assignments list below as your order of work.',
    };
  }

  if (input.weakestTopic && input.weakestTopicScore != null && input.weakestTopicScore < 65) {
    return {
      seed,
      tone: 'focus',
      eyebrow: 'Strengthen a weak topic',
      message: chooseDaily(input, [
        `${input.weakestTopic} is your clearest improvement opportunity at ${input.weakestTopicScore}%. A short focused practice block will move the right metric.`,
        `Your current weak spot is ${input.weakestTopic} at ${input.weakestTopicScore}%. Review one worked example, then solve a similar question independently.`,
        `Prioritise ${input.weakestTopic} today. Its ${input.weakestTopicScore}% mastery score makes it the best place to spend your next practice block.`,
      ]),
      action: `Spend 25 focused minutes on ${input.weakestTopic}.`,
    };
  }

  if (input.attendanceRate != null && input.attendanceRate < 75) {
    return {
      seed,
      tone: 'focus',
      eyebrow: 'Rebuild consistency',
      message: chooseDaily(input, [
        `Your recent attendance is ${input.attendanceRate}%. Reconnect with the plan today by completing one focused learning block.`,
        `Attendance is currently ${input.attendanceRate}%. Use today's session or practice block to restart a steady routine.`,
        `Your ${input.attendanceRate}% attendance rate is the signal to act on today. Choose one manageable task and finish it fully.`,
      ]),
      action: 'Set aside one protected study block and attend your next scheduled session.',
    };
  }

  if (input.averageScore != null && input.averageScore < 65) {
    return {
      seed,
      tone: 'focus',
      eyebrow: 'Lift the recent average',
      message: chooseDaily(input, [
        `Your recent average is ${input.averageScore}%. Review one mistake pattern today and practise the corrected method.`,
        `A ${input.averageScore}% recent average gives you a clear target: revisit one difficult question and solve a similar example independently.`,
        `Your recent marks average ${input.averageScore}%. Use today's practice block to turn one weak method into a repeatable strength.`,
      ]),
      action: 'Review recent feedback before starting a fresh practice question.',
    };
  }

  if ((input.streakDays || 0) >= 3) {
    return {
      seed,
      tone: 'momentum',
      eyebrow: 'Keep the streak moving',
      message: chooseDaily(input, [
        `Your ${input.streakDays}-day study streak is working. Keep it alive with one focused task${input.averageScore == null ? '' : ` while your recent average sits at ${input.averageScore}%`}.`,
        `You have studied for ${input.streakDays} days in a row. Protect that consistency with one meaningful practice block today.`,
        `${input.streakDays} days of steady effort gives you momentum. Use it on your next assignment or a targeted topic review.`,
      ]),
      action: 'Complete one focused learning block before the day gets busy.',
    };
  }

  return {
    seed,
    tone: 'steady',
    eyebrow: "Build today's momentum",
    message: chooseDaily(input, [
      `You have ${input.assignmentPressure} active assignment${input.assignmentPressure === 1 ? '' : 's'} requiring action. Use one focused study block to make measurable progress today.`,
      `Today's plan can stay simple: move one of your ${input.assignmentPressure} active assignment${input.assignmentPressure === 1 ? '' : 's'} forward and finish with a short review.`,
      `Your dashboard shows ${input.assignmentPressure} active assignment${input.assignmentPressure === 1 ? '' : 's'}. Choose one practical next step and complete it before adding more.`,
    ]),
    action: input.assignmentPressure ? 'Start with the next due assignment.' : "Use a short practice block to establish today's momentum.",
  };
}

export function selectDailyInsight(data: StudentDashboardView, studentData: NormalizedStudentData, now = new Date()) {
  return getDailyInsight(selectDailyInsightInput(data, studentData, now));
}
