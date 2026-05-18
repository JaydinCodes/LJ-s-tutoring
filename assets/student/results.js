import { renderError, renderLoading, setActiveNav } from '/assets/common.js';
import { fetchClassStats, fetchStudentResults } from '/assets/student/learning-api.js';

setActiveNav('results');

const list = document.getElementById('resultsPageList');
const comparison = document.getElementById('resultsComparison');
const resultsAverage = document.getElementById('resultsAverage');
const resultsLatest = document.getElementById('resultsLatest');
const resultsLatestMeta = document.getElementById('resultsLatestMeta');
const resultsStrength = document.getElementById('resultsStrength');
const resultsStrengthMeta = document.getElementById('resultsStrengthMeta');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function empty(target, title, copy) {
  target.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(copy)}</div>`;
}

function renderResults(result) {
  if (!result.available) {
    empty(list, 'Results API not enabled yet.', 'When /student/results is available, this page will show marked assignments, scores, strengths, and improvement areas.');
    if (resultsAverage) {resultsAverage.textContent = '—';}
    if (resultsLatest) {resultsLatest.textContent = '—';}
    if (resultsLatestMeta) {resultsLatestMeta.textContent = 'Awaiting marks';}
    if (resultsStrength) {resultsStrength.textContent = '—';}
    if (resultsStrengthMeta) {resultsStrengthMeta.textContent = 'Awaiting tutor feedback';}
    return;
  }
  if (!result.items.length) {
    empty(list, 'No marked assignments yet.', 'Once your tutor marks your work, your results and feedback will appear here.');
    if (resultsAverage) {resultsAverage.textContent = '—';}
    if (resultsLatest) {resultsLatest.textContent = '—';}
    if (resultsLatestMeta) {resultsLatestMeta.textContent = 'Awaiting marks';}
    if (resultsStrength) {resultsStrength.textContent = '—';}
    if (resultsStrengthMeta) {resultsStrengthMeta.textContent = 'Awaiting tutor feedback';}
    return;
  }
  list.innerHTML = '';
  result.items.forEach((item) => {
    const pct = item.percentage ?? (item.totalMarks ? Math.round((Number(item.score || 0) / Number(item.totalMarks)) * 100) : null);
    const meta = [item.subject, item.topic, item.markedAt ? `Marked ${new Date(item.markedAt).toLocaleDateString('en-ZA')}` : ''].filter(Boolean).join(' • ');
    const strengths = Array.isArray(item.strengths) ? item.strengths.join(', ') : item.strengths;
    const improvementAreas = Array.isArray(item.improvementAreas) ? item.improvementAreas.join(', ') : item.improvementAreas;

    const card = document.createElement('article');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="status-row">
        <div>
          <span class="tiny-label">${escapeHtml(item.subject || 'Result')}</span>
          <h3 class="panel-title">${escapeHtml(item.title || 'Marked work')}</h3>
        </div>
        <strong class="result-score">${pct === null || pct === undefined ? '—' : `${Math.round(Number(pct))}%`}</strong>
      </div>
      <div class="result-meta">${escapeHtml(meta)}</div>
      <p>${escapeHtml(item.feedbackSummary || 'Feedback summary will appear here once available.')}</p>
      <p class="note"><strong>Strengths:</strong> ${escapeHtml(strengths || 'Awaiting feedback')}</p>
      <p class="note"><strong>Improve next:</strong> ${escapeHtml(improvementAreas || 'Awaiting feedback')}</p>
    `;

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    const detail = document.createElement('a');
    detail.className = 'button secondary';
    detail.href = `/dashboard/results/detail/?id=${encodeURIComponent(item.id)}`;
    detail.textContent = 'View details';
    const report = document.createElement('a');
    report.className = 'button secondary';
    report.href = item.reportId ? `/reports/detail/?id=${encodeURIComponent(item.reportId)}` : '/reports/';
    report.textContent = 'Open report';
    actions.append(detail, report);
    card.append(actions);
    list.append(card);
  });

  const percentages = result.items.map((item) => Number(item.percentage)).filter(Number.isFinite);
  const average = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  if (resultsAverage) {
    resultsAverage.textContent = average === null ? '—' : `${average}%`;
  }
  if (result.items[0] && resultsLatest && resultsLatestMeta) {
    const first = result.items[0];
    const latestPct = first.percentage ?? (first.totalMarks ? Math.round((Number(first.score || 0) / Number(first.totalMarks)) * 100) : null);
    resultsLatest.textContent = latestPct == null ? '—' : `${latestPct}%`;
    resultsLatestMeta.textContent = first.markedAt
      ? `Marked ${new Date(first.markedAt).toLocaleDateString('en-ZA')}`
      : 'Awaiting marked work';
  }
  if (resultsStrength && resultsStrengthMeta) {
    const first = result.items[0];
    const topStrength = Array.isArray(first?.strengths) ? first.strengths[0] : first?.strengths;
    resultsStrength.textContent = topStrength || '—';
    resultsStrengthMeta.textContent = topStrength ? 'Lead strength' : 'Awaiting tutor feedback';
  }
}

function renderStats(result) {
  if (!result.available) {
    empty(comparison, 'Class comparison is waiting for API support.', 'Anonymised class statistics will appear here without exposing learner names.');
    return;
  }
  const stat = result.items[0] || result.payload?.stats?.[0];
  if (!stat) {
    empty(comparison, 'No comparison yet.', 'Comparison appears once enough marked group data exists.');
    return;
  }
  const learner = Number(stat.learnerScore ?? stat.learner_score ?? 0);
  const average = Number(stat.classAverage ?? stat.class_average ?? 0);
  const high = Number(stat.highestScore ?? stat.highest_score ?? 0);
  const low = Number(stat.lowestScore ?? stat.lowest_score ?? 0);
  const message = learner >= average
    ? 'You are above the group average. Keep consolidating the method so it becomes reliable.'
    : 'You are close to the next band. Revise the target topic and try three focused questions.';

  comparison.innerHTML = `<p>${escapeHtml(message)} Keep using feedback as a map for the next practice step.</p>`;
  [
    ['You', learner],
    ['Average', average],
    ['Highest', high],
    ['Lowest', low],
  ].forEach(([label, value]) => {
    comparison.insertAdjacentHTML('beforeend', `<div class="band-row"><span>${escapeHtml(label)}</span><div class="band-track"><span style="width:${Math.max(4, Math.min(100, value))}%"></span></div><strong>${Math.round(value)}%</strong></div>`);
  });

  const distribution = Array.isArray(stat.distribution) ? stat.distribution : null;
  const bands = Array.isArray(stat.bands) ? stat.bands : null;
  if (distribution && distribution.length) {
    const maxValue = Math.max(...distribution.map((value) => Number(value || 0)), 1);
    comparison.insertAdjacentHTML('beforeend', '<div class="distribution"></div>');
    const container = comparison.querySelector('.distribution');
    distribution.forEach((value, index) => {
      const label = bands?.[index]?.label || `Band ${index + 1}`;
      const pct = Math.round((Number(value || 0) / maxValue) * 100);
      container.insertAdjacentHTML(
        'beforeend',
        `<div class="distribution-row"><span>${escapeHtml(label)}</span><div class="distribution-bar"><span style="width:${pct}%"></span></div><strong>${Number(value || 0)}</strong></div>`
      );
    });
  }
}

renderLoading(list, 'Loading results...');
renderLoading(comparison, 'Loading anonymised comparison...');
try {
  const [results, stats] = await Promise.all([fetchStudentResults(), fetchClassStats()]);
  renderResults(results);
  renderStats(stats);
} catch {
  renderError(list, 'Could not load results.');
  renderError(comparison, 'Could not load comparison.');
}
