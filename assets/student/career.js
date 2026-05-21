import { setActiveNav } from '/assets/common.js';
import { initOdieAssistant } from '/assets/student/odie-assistant.js';
import {
  escapeHtml,
  isUnauthorizedError,
  loadOdieOverview,
  renderAuthState,
  setOverviewCounts,
} from '/assets/student/odie-careers.js';

setActiveNav('career');
initOdieAssistant({
  defaultSubject: 'Career pathways',
  careerPathwayContext: 'The learner is using the Odie Careers dashboard for South Africa-aware career exploration, APS/course eligibility, subject choices, and study planning.',
});

const careerCount = document.getElementById('careerCount');
const courseCount = document.getElementById('courseCount');
const institutionCount = document.getElementById('institutionCount');
const sourceGeneratedAt = document.getElementById('sourceGeneratedAt');
const highlights = document.getElementById('odieOverviewHighlights');

function renderHighlights(overview) {
  highlights.innerHTML = `
    <div class="list-item">
      <strong>${overview.careers.length} careers ready to explore</strong>
      <p>Search, inspect forecasts, and move across related paths without completing a quiz first.</p>
    </div>
    <div class="list-item">
      <strong>${overview.institutions.length} Cape Town institutions covered</strong>
      <p>First-year routes are normalized across universities, colleges, TVETs, and private institutions.</p>
    </div>
    <div class="list-item">
      <strong>${overview.supportedSubjects.length} supported subject inputs</strong>
      <p>Course eligibility can be checked directly from your current NSC-style marks.</p>
    </div>
  `;
}

async function bootstrap() {
  try {
    const overview = await loadOdieOverview();
    setOverviewCounts(overview, {
      careerCount,
      courseCount,
      institutionCount,
      sourceGeneratedAt,
    });
    renderHighlights(overview);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      renderAuthState(highlights, 'Odie Careers preview is warming up.');
      sourceGeneratedAt.textContent = 'Odie Careers preview is still being wired up in development mode.';
      return;
    }

    highlights.innerHTML = `
      <div class="empty-state error-state">
        <strong>Odie Careers is temporarily unavailable.</strong>
        <p>${escapeHtml(error instanceof Error ? error.message : 'unknown_error')}</p>
        <button class="button" type="button" id="odieRetryButton">Retry overview</button>
      </div>
    `;
    document.getElementById('odieRetryButton')?.addEventListener('click', bootstrap);
  }
}

bootstrap();
