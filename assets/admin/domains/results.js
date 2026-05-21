import { apiGet, escapeHtml, qs, renderSkeletonCards, renderStateCard, setActiveNav } from '/assets/portal-shared.js';

setActiveNav('results');

function barRow(label, value, suffix = '%') {
  const numeric = Number(value || 0);
  const width = Math.max(4, Math.min(100, numeric));
  return `<div class="band-row"><span>${escapeHtml(label)}</span><div class="band-track"><span style="width:${width}%"></span></div><strong>${Math.round(numeric)}${suffix}</strong></div>`;
}

function empty(target, title, description) {
  renderStateCard(target, { variant: 'empty', title, description });
}

function renderMetricList(target, rows, getLabel, getValue, suffix) {
  if (!rows?.length) {
    empty(target, 'No data yet', 'This visual appears once results have been recorded.');
    return;
  }
  target.innerHTML = rows.map((row) => barRow(getLabel(row), getValue(row), suffix)).join('');
}

async function init() {
  const targets = [
    '#adminResultsSummary',
    '#adminScoreDistribution',
    '#adminResultsTrend',
    '#adminWeakAreas',
    '#adminStudentPerformance',
    '#adminClassificationReport',
    '#adminConfusionMatrix',
  ].map((selector) => qs(selector)).filter(Boolean);
  targets.forEach((target) => renderSkeletonCards(target, 2));

  try {
    const data = await apiGet('/admin/results/analytics');
    const summary = qs('#adminResultsSummary');
    summary.innerHTML = `
      <div class="list-item"><strong>${Math.round(Number(data.summary?.class_average || 0))}%</strong><span>Class average</span></div>
      <div class="list-item"><strong>${Number(data.summary?.results_count || 0)}</strong><span>Recorded results</span></div>
    `;
    renderMetricList(qs('#adminScoreDistribution'), data.scoreDistribution, (row) => `Band ${row.bucket}`, (row) => Number(row.count), '');
    renderMetricList(qs('#adminResultsTrend'), data.trend, (row) => String(row.period).slice(0, 10), (row) => row.average, '%');
    renderMetricList(qs('#adminWeakAreas'), data.weakAreas, (row) => row.topic, (row) => row.average_score, '%');
    renderMetricList(qs('#adminStudentPerformance'), data.students, (row) => row.full_name, (row) => row.average_score, '%');

    if (data.classificationReport?.length) {
      qs('#adminClassificationReport').innerHTML = data.classificationReport.map((row) => `
        <div class="list-item"><strong>${escapeHtml(row.label)}</strong><span>Precision ${row.precision} | Recall ${row.recall} | F1 ${row.f1} | Support ${row.support}</span></div>
      `).join('');
    } else {
      empty(qs('#adminClassificationReport'), 'No classification report', 'Precision, recall, F1, and support render only when model metrics exist.');
    }

    if (data.confusionMatrix?.length) {
      qs('#adminConfusionMatrix').innerHTML = data.confusionMatrix.map((row) => `<div class="list-item">${escapeHtml(JSON.stringify(row))}</div>`).join('');
    } else {
      empty(qs('#adminConfusionMatrix'), 'No confusion matrix', 'Confusion matrix data has not been generated for these results yet.');
    }
  } catch {
    targets.forEach((target) => renderStateCard(target, {
      variant: 'error',
      title: 'Unable to load analytics',
      description: 'Refresh and try again.',
    }));
  }
}

init();
