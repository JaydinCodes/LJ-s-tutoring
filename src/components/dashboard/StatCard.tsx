import { BookOpen, Clock, LayoutDashboard, ScrollText, Trophy, TrendingUp, type LucideIcon } from 'lucide-react';
import type { DashboardMetric } from '../../types/lms';
import { MetricCard } from './DashboardDesignSystem';

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const tone = ({
    teal: 'aegean',
    violet: 'navy',
    amber: 'gold',
    blue: 'aegean',
    slate: 'marble',
  } as const)[metric.tone];

  return <MetricCard label={metric.label} value={metric.value} helper={metric.helper} icon={iconForMetric(metric.label)} tone={tone} />;
}

function iconForMetric(label: string): LucideIcon {
  const normalized = label.toLowerCase();
  if (normalized.includes('score') || normalized.includes('average') || normalized.includes('mark')) return Trophy;
  if (normalized.includes('assignment') || normalized.includes('submission')) return ScrollText;
  if (normalized.includes('attendance') || normalized.includes('streak')) return Clock;
  if (normalized.includes('class') || normalized.includes('subject')) return BookOpen;
  if (normalized.includes('progress') || normalized.includes('growth')) return TrendingUp;
  return LayoutDashboard;
}
