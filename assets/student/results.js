import { renderError, renderLoading, setActiveNav } from '/assets/common.js';
import { fetchClassStats, fetchStudentResults } from '/assets/student/learning-api.js';

setActiveNav('results');

const list = document.getElementById('resultsPageList');
const comparison = document.getElementById('resultsComparison');

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
    return;
  }
  if (!result.items.length) {
    empty(list, 'No marked assignments yet.', 'Once your tutor marks your work, your results and feedback will appear here.');
    return;
  }
  list.innerHTML = result.items.map((item) => {
    const pct = item.percentage ?? (item.totalMarks ? Math.round((Number(item.score || 0) / Number(item.totalMarks)) * 100) : null);
    const meta = [item.subject, item.topic, item.markedAt ? `Marked ${new Date(item.markedAt).toLocaleDateString('en-ZA')}` : ''].filter(Boolean).join(' | ');
    const strengths = Array.isArray(item.strengths) ? item.strengths.join(', ') : item.strengths;
    const improvementAreas = Array.isArray(item.improvementAreas) ? item.improvementAreas.join(', ') : item.improvementAreas;
    return `<article class="list-item">
      <div class="row-head">
        <div>
          <strong>${escapeHtml(item.title || 'Marked work')}</strong>
          <div class="note">${escapeHtml(meta)}</div>
        </div>
        <strong class="metric-value">${pct === null || pct === undefined ? '&mdash;' : `${Math.round(Number(pct))}%`}</strong>
      </div>
      <p>${escapeHtml(item.feedbackSummary || 'Feedback summary will appear here once available.')}</p>
      <p class="note"><strong>Strengths:</strong> ${escapeHtml(strengths || 'Awaiting feedback')}</p>
      <p class="note"><strong>Improve next:</strong> ${escapeHtml(improvementAreas || 'Awaiting feedback')}</p>
    </article>`;
  }).join('');
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
  const rows = [
    ['You', Number(stat.learnerScore ?? stat.learner_score ?? 0)],
    ['Average', Number(stat.classAverage ?? stat.class_average ?? 0)],
    ['Highest', Number(stat.highestScore ?? stat.highest_score ?? 0)],
  ];
  comparison.innerHTML = `<p>${rows[0][1] >= rows[1][1] ? 'You are above the group average.' : 'You are close to the next band.'} Keep using feedback as a map for the next practice step.</p>`;
  rows.forEach(([label, value]) => {
    comparison.insertAdjacentHTML('beforeend', `<div class="band-row"><span>${escapeHtml(label)}</span><div class="band-track"><span style="width:${Math.max(4, Math.min(100, value))}%"></span></div><strong>${Math.round(value)}%</strong></div>`);
  });
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
