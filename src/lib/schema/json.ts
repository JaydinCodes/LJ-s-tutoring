import type { Json } from '../../types/database';
import type { WeeklyReportPayload } from '../../types/lms';

export function jsonObject(value: Json | undefined, label: string): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${label} must be an object.`);
  return value;
}

export function jsonArray(value: Json | undefined, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

export function jsonString(value: Json | undefined, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  return value;
}

export function jsonNumber(value: Json | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a number.`);
  return value;
}

export function weeklyReportPayload(value: Json): WeeklyReportPayload {
  const root = jsonObject(value, 'weekly report payload');
  const student = jsonObject(root.student, 'weekly report student');
  const week = jsonObject(root.week, 'weekly report week');
  const metrics = jsonObject(root.metrics, 'weekly report metrics');
  return {
    student: { id: jsonString(student.id, 'weekly report student.id'), name: jsonString(student.name, 'weekly report student.name'), grade: typeof student.grade === 'string' ? student.grade : null },
    week: { start: jsonString(week.start, 'weekly report week.start'), end: jsonString(week.end, 'weekly report week.end') },
    metrics: { sessionsAttended: jsonNumber(metrics.sessionsAttended, 'weekly report metrics.sessionsAttended'), timeStudiedMinutes: jsonNumber(metrics.timeStudiedMinutes, 'weekly report metrics.timeStudiedMinutes') },
    topicProgress: jsonArray(root.topicProgress, 'weekly report topicProgress').map((item) => {
      const topic = jsonObject(item, 'weekly report topic');
      return { subject: jsonString(topic.subject, 'weekly report topic.subject'), topic: jsonString(topic.topic, 'weekly report topic.topic'), completion: jsonNumber(topic.completion, 'weekly report topic.completion') };
    }),
    tutorNotesSummary: jsonArray(root.tutorNotesSummary, 'weekly report tutorNotesSummary').map((item) => jsonString(item, 'weekly report tutor note')),
    goalsNextWeek: jsonArray(root.goalsNextWeek, 'weekly report goalsNextWeek').map((item) => jsonString(item, 'weekly report goal')),
  };
}
