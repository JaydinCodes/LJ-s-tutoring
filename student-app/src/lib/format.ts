export function formatDate(value?: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) {return '';}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return value;}
  return date.toLocaleDateString('en-ZA', options);
}

export function daysUntil(value?: string) {
  if (!value) {return null;}
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) {return null;}
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, item) => total + item, 0) / values.length) : null;
}
