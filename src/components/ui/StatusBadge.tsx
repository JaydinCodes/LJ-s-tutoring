import type { AssignmentLifecycleStatus } from '../../features/assignments/assignmentStatus';
import { getAssignmentStatusLabel, getAssignmentStatusVariant } from '../../features/assignments/assignmentStatus';

const assignmentStatuses = new Set<string>([
  'not_started',
  'due_soon',
  'submitted',
  'late_submitted',
  'under_review',
  'marked',
  'returned_for_correction',
  'missing',
  'closed',
  'draft',
  'archived',
]);

const variantClass = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const isAssignmentStatus = assignmentStatuses.has(normalized);
  const label = isAssignmentStatus
    ? getAssignmentStatusLabel(normalized as AssignmentLifecycleStatus)
    : value.replace(/_/g, ' ');
  const tone = isAssignmentStatus
    ? variantClass[getAssignmentStatusVariant(normalized as AssignmentLifecycleStatus)]
    : normalized.includes('paid') || normalized.includes('active') || normalized.includes('marked')
      ? variantClass.success
      : normalized.includes('overdue') || normalized.includes('rejected') || normalized.includes('missing')
        ? variantClass.danger
        : normalized.includes('pending') || normalized.includes('draft') || normalized.includes('returned')
          ? variantClass.warning
          : variantClass.neutral;

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${tone}`}>{label}</span>;
}
