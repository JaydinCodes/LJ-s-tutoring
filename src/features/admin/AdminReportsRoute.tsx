import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { NgoPartner } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';

export function AdminReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Reports" subtitle="NGO, parent, ProVision, team, and operational reporting foundation." section="admin">
      {data ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
        </section>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card>
          <h2 className="text-xl font-semibold text-slate-950">NGO partners</h2>
          <div className="mt-4">
            {loading ? <p className="text-sm text-slate-600">Loading reports...</p> : null}
            {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
            {data ? (
              <DataTable<NgoPartner>
                rows={data.ngoPartners}
                empty="No NGO partner records are available yet."
                columns={[
                  { key: 'name', label: 'Partner', render: (row) => <span className="font-semibold text-slate-950">{row.name}</span> },
                  { key: 'contact', label: 'Contact', render: (row) => row.contact_person || 'Pending' },
                  { key: 'email', label: 'Email', render: (row) => row.contact_email || 'Pending' },
                  { key: 'location', label: 'Location', render: (row) => row.location || 'Pending' },
                ]}
              />
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Organogram</h2>
          <div className="mt-4 space-y-3">
            {(data?.team || []).map((member) => (
              <div key={`${member.name}-${member.role}`} className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">{member.name}</p>
                <p className="text-sm text-slate-600">{member.role} | {member.focus}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </DashboardShell>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Data unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
