import { apiGet, apiPost } from '../../lib/api/client';

export interface WeeklyReportListItem {
  id: string;
  week_start?: string;
  weekStart?: string;
  week_end?: string;
  weekEnd?: string;
  created_at?: string;
  createdAt?: string;
}

export interface WeeklyReport {
  id: string;
  weekStart?: string;
  weekEnd?: string;
  week_start?: string;
  week_end?: string;
  createdAt?: string;
  created_at?: string;
  payload?: {
    sessionsAttended?: number;
    minutesStudied?: number;
    summary?: string;
    topics?: string[];
    assignmentHighlights?: string[];
    nextBestStep?: string;
  };
}

async function optionalReportGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('501') ||
      message.includes('Failed to fetch')
    ) {
      return fallback;
    }
    throw error;
  }
}

export function loadWeeklyReports() {
  return optionalReportGet<{ items: WeeklyReportListItem[]; total?: number }>('/reports', { items: [] });
}

export function loadWeeklyReport(reportId: string) {
  return apiGet<{ report: WeeklyReport }>(`/reports/${encodeURIComponent(reportId)}`);
}

export function generateWeeklyReport() {
  return apiPost<{ report: WeeklyReport }>('/reports/generate', {});
}
