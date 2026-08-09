const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');

test('PERF-01 report metrics are database aggregates and dashboard detail lists are explicitly bounded', () => {
  const migration = read('supabase/migrations/20260809185704_eliminate_unbounded_report_reads.sql');
  const adminReports = read('src/features/admin/adminProgressReportsRepository.ts');
  const payroll = read('src/features/admin/adminPayrollRepository.ts');
  const dashboard = read('src/features/students/studentDashboardRepository.ts');

  assert.match(migration, /get_admin_progress_reports/);
  assert.match(migration, /get_admin_payroll_view/);
  assert.match(migration, /get_student_dashboard_metrics/);
  assert.match(migration, /jsonb_agg/);
  assert.match(migration, /count\(distinct sub\.assignment_id\)/);
  assert.match(adminReports, /callRpc\(client, 'get_admin_progress_reports'/);
  assert.match(payroll, /callRpc\(client, 'get_admin_payroll_view'/);
  assert.match(dashboard, /DASHBOARD_DETAIL_LIMIT = 100/);
  assert.match(dashboard, /get_student_dashboard_metrics/);
  assert.match(dashboard, /\.limit\(DASHBOARD_DETAIL_LIMIT\)/);
});
