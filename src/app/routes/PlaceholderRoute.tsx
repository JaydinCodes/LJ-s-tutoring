import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { EmptyState } from '../../components/ui/EmptyState';

export function PlaceholderRoute({ title, area }: { title: string; area: string }) {
  return (
    <DashboardShell title={title} subtitle={`${area} route reserved for the React migration.`} section="student">
      <EmptyState
        title="Migration route scaffolded"
        description="The static equivalent should remain active until this route has feature parity, Supabase-backed data, and regression coverage."
      />
    </DashboardShell>
  );
}
