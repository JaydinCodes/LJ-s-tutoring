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

  return <MetricCard label={metric.label} value={metric.value} helper={metric.helper} tone={tone} />;
}
