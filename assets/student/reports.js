
import {
  apiFetch,
  clearChildren,
  loadJson,
  renderError,
  renderList,
  renderLoading,
  setActiveNav,
} from '/assets/common.js';
import { track } from '/assets/analytics-module.js';

setActiveNav('reports');

const LIST_ID = 'studentReportsList';

function toText(value, fallback = '') {
  if (value === null || value === undefined) {return fallback;}
  return String(value);
}

function toDateOnly(value) {
  if (!value) {return '';}
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

function formatCreatedAt(value) {
  if (!value) {return '';}
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {return toText(value);}
  return d.toLocaleString();
}

function buildDetailNode() {
  const detail = document.createElement('div');
  detail.className = 'report-detail';
  detail.hidden = true;
  detail.setAttribute('role', 'region');
  detail.setAttribute('aria-live', 'polite');
  return detail;
}

function makeDetailLine(label, value) {
  const line = document.createElement('div');
  line.className = 'report-detail-line';
  const labelEl = document.createElement('strong');
  labelEl.textContent = `${label}: `;
  const valueEl = document.createElement('span');
  valueEl.textContent = toText(value, '—');
  line.append(labelEl, valueEl);
  return line;
}

function renderReportDetail(detail, report) {
  clearChildren(detail);
  detail.hidden = false;
  const payload = report && report.payload ? report.payload : {};
  const summary = document.createElement('div');
  summary.className = 'report-detail-summary';
  summary.append(
    makeDetailLine('Week', `${toDateOnly(report.weekStart)} → ${toDateOnly(report.weekEnd)}`),
    makeDetailLine('Generated', formatCreatedAt(report.createdAt)),
    makeDetailLine('Sessions attended', payload.sessionsAttended ?? 0),
    makeDetailLine('Minutes studied', payload.minutesStudied ?? 0),
  );
  if (payload.summary) {
    const note = document.createElement('p');
    note.className = 'report-detail-note';
    note.textContent = String(payload.summary);
    summary.appendChild(note);
  }
  detail.appendChild(summary);
}

function renderReportRow(item, onOpen) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item report-item';

  const header = document.createElement('div');
  header.className = 'report-header';
  const title = document.createElement('strong');
  title.textContent = 'Weekly learning report';
  const range = document.createElement('div');
  range.textContent = `${toDateOnly(item.week_start)} → ${toDateOnly(item.week_end)}`;
  const created = document.createElement('div');
  created.textContent = `Created: ${formatCreatedAt(item.created_at)}`;
  const topics = document.createElement('div');
  topics.className = 'note';
  topics.textContent = 'Attendance, topic rhythm, confidence and assignment highlights.';
  header.append(title, range, created, topics);

  const detail = buildDetailNode();

  const actions = document.createElement('div');
  actions.className = 'report-actions';
  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'button secondary';
  viewBtn.textContent = 'View details';
  viewBtn.addEventListener('click', async () => {
    if (!detail.hidden) {
      detail.hidden = true;
      viewBtn.textContent = 'View details';
      return;
    }
    viewBtn.disabled = true;
    viewBtn.textContent = 'Loading…';
    try {
      const data = await loadJson(`/reports/${encodeURIComponent(item.id)}`);
      if (data && data.report) {
        renderReportDetail(detail, data.report);
        track('report.viewed', { reportId: item.id });
        onOpen?.(data.report);
      } else {
        renderError(detail, 'Could not load report.');
        detail.hidden = false;
      }
      viewBtn.textContent = 'Hide details';
    } catch (_err) {
      renderError(detail, 'Could not load report.');
      detail.hidden = false;
      viewBtn.textContent = 'View details';
    } finally {
      viewBtn.disabled = false;
    }
  });
  actions.appendChild(viewBtn);

  wrapper.append(header, actions, detail);
  return wrapper;
}

async function loadReports() {
  const target = document.getElementById(LIST_ID);
  if (!target) {return;}
  renderLoading(target, 'Loading your weekly reports…');
  try {
    const data = await loadJson('/reports');
    const items = data.items || [];
    if (!items.length) {
      target.innerHTML = '<div class="empty-state"><strong>No reports generated yet.</strong>Reports become useful after sessions are approved and learning activity exists. Generate one when you want a weekly summary of attendance, topics, confidence, and assignment highlights.</div>';
      return;
    }
    renderList(target, items, (item) => renderReportRow(item));
  } catch (_err) {
    renderError(target, 'Could not load your reports. Please try again.');
  }
}

function attachGenerateButton() {
  const btn = document.getElementById('generateReportBtn');
  const status = document.getElementById('generateReportStatus');
  if (!btn) {return;}
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const progress = document.getElementById('reportGenerateProgress');
    const prev = btn.textContent;
    btn.textContent = 'Generating…';
    if (status) {status.textContent = '';}
    if (progress) {progress.style.width = '42%';}
    try {
      const res = await apiFetch('/reports/generate', { method: 'POST', body: {} });
      if (!res.ok) {
        throw new Error(`request_failed:${res.status}`);
      }
      const body = await res.json();
      track('report.generated', { reportId: body?.report?.id });
      if (status) {
        status.textContent = 'Report generated successfully. It has been added to your history.';
        status.dataset.state = 'ok';
      }
      if (progress) {progress.style.width = '100%';}
      await loadReports();
    } catch (_err) {
      if (status) {
        status.textContent = 'Could not generate a report right now. You may need approved sessions or more learner activity first.';
        status.dataset.state = 'error';
      }
      if (progress) {progress.style.width = '12%';}
    } finally {
      btn.textContent = prev;
      btn.disabled = false;
    }
  });
}

attachGenerateButton();
await loadReports();
