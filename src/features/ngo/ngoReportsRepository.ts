import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2ENgoReports } from '../../lib/e2e/mockRoleData';
import { captureAppError } from '../../lib/monitoring/errorReporting';
import { requireSupabase } from '../../lib/supabase/client';

export interface NgoAggregateReport {
  ngo_partner_id: string;
  ngo_partner_name: string;
  student_count: number;
  released_results: number;
  average_mark: number | null;
  active_classes: number;
  progress_topic_count: number;
  active_learner_count?: number;
  session_count?: number;
  attended_session_count?: number;
  attendance_rate?: number | null;
  competency_evidence_count?: number;
  average_competency_score?: number | null;
  intervention_count?: number;
  suppressed?: boolean;
  suppression_reason?: string;
}

type CohortRpcReport = {
  organization_id: string;
  learner_count: number;
  suppressed: boolean;
  suppression_reason?: string;
  average_progress_score?: number;
  marked_submission_count?: number;
  active_learner_count?: number;
  session_count?: number;
  attended_session_count?: number;
  attendance_rate?: number | null;
  competency_evidence_count?: number;
  average_competency_score?: number | null;
  intervention_count?: number;
};
type NgoMembership = { organization_id: string; organizations: { name?: string } | null };
type CohortRpcClient = { rpc: (name: 'get_org_cohort_report', args: { p_org_id: string }) => Promise<{ data: unknown; error: Error | null }> };

const MEMBERSHIP_PAGE_SIZE = 100;

async function loadNgoMemberships(client: ReturnType<typeof requireSupabase>): Promise<NgoMembership[]> {
  const rows: NgoMembership[] = [];
  for (let offset = 0; ; offset += MEMBERSHIP_PAGE_SIZE) {
    const page = await client
      .from('organization_members')
      .select('organization_id, organizations(name)')
      .eq('org_role', 'partner_viewer')
      .eq('status', 'active')
      .order('organization_id')
      .range(offset, offset + MEMBERSHIP_PAGE_SIZE - 1);
    if (page.error) throw page.error;
    const pageRows = (page.data || []) as unknown as NgoMembership[];
    rows.push(...pageRows);
    if (pageRows.length < MEMBERSHIP_PAGE_SIZE) return rows;
  }
}

export async function loadNgoReports(): Promise<{ reports: NgoAggregateReport[] }> {
  if (isE2EAuthMockEnabled()) return getE2ENgoReports();

  const client = requireSupabase();
  // An NGO partner may see only its own membership rows. Every cohort metric
  // comes from the SECURITY DEFINER aggregate RPC; do not join learner data in
  // the browser, even for counts.
  let memberRows: NgoMembership[];
  try {
    memberRows = await loadNgoMemberships(client);
  } catch (error) {
    captureAppError(error, { featureArea: 'ngo', action: 'ngo_reports.memberships_load_failed', role: 'ngo_partner' });
    throw error;
  }
  const reports = await Promise.all(memberRows.map(async (membership) => {
    const result = await (client as unknown as CohortRpcClient).rpc('get_org_cohort_report', { p_org_id: membership.organization_id });
    if (result.error) {
      captureAppError(result.error, { featureArea: 'ngo', action: 'ngo_reports.aggregate_load_failed', role: 'ngo_partner' });
      throw result.error;
    }
    const aggregate = result.data as unknown as CohortRpcReport;
    const organization = membership.organizations;
    return {
      ngo_partner_id: membership.organization_id,
      ngo_partner_name: organization?.name || 'Partner cohort',
      student_count: aggregate.learner_count,
      // The approved RPC exposes marked submission counts, not learner-level
      // result rows. Keep this legacy UI field until its label is renamed.
      released_results: aggregate.marked_submission_count || 0,
      average_mark: aggregate.average_progress_score ?? null,
      active_classes: 0,
      progress_topic_count: 0,
      suppressed: aggregate.suppressed,
      suppression_reason: aggregate.suppression_reason,
      active_learner_count: aggregate.active_learner_count,
      session_count: aggregate.session_count,
      attended_session_count: aggregate.attended_session_count,
      attendance_rate: aggregate.attendance_rate ?? null,
      competency_evidence_count: aggregate.competency_evidence_count,
      average_competency_score: aggregate.average_competency_score ?? null,
      intervention_count: aggregate.intervention_count,
    } satisfies NgoAggregateReport;
  }));

  return { reports };
}
