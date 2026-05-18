import { setActiveNav } from '/assets/common.js';
import {
  escapeHtml,
  isUnauthorizedError,
  loadOdieOverview,
  renderAuthState,
  setOverviewCounts,
} from '/assets/student/odie-careers.js';

setActiveNav('career');

const careerCount = document.getElementById('careerCount');
const courseCount = document.getElementById('courseCount');
const institutionCount = document.getElementById('institutionCount');
const sourceGeneratedAt = document.getElementById('sourceGeneratedAt');
const highlights = document.getElementById('odieOverviewHighlights');
const careerGoalCard = document.getElementById('careerGoalCard');
const careerSkills = document.getElementById('careerSkills');
const careerMilestones = document.getElementById('careerMilestones');

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

function renderCareerPathway(overview) {
  if (careerGoalCard) {
    careerGoalCard.innerHTML = `
      <strong>No career goal selected yet.</strong>
      Choose a career path to unlock readiness milestones, subject relevance, and next actions.
      <a class="button secondary" href="/dashboard/career/paths/" style="margin-top:0.75rem; display:inline-flex;">Browse career paths</a>
    `;
  }

  if (careerSkills) {
    if (!overview.supportedSubjects?.length) {
      careerSkills.innerHTML = '<div class="empty-state"><strong>No subject relevance data yet.</strong>Once a career goal is set, we will show which subjects matter most.</div>';
    } else {
      careerSkills.innerHTML = overview.supportedSubjects.slice(0, 6).map((subject) => `
        <div class="list-item">
          <strong>${escapeHtml(subject)}</strong>
          <p class="note">Strong performance here supports multiple career routes.</p>
        </div>
      `).join('');
    }
  }

  if (careerMilestones) {
    careerMilestones.innerHTML = `
      <div class="list-item">
        <strong>Set a goal</strong>
        <p class="note">Pick a path to see readiness milestones and recommended skills.</p>
      </div>
      <div class="list-item">
        <strong>Build evidence</strong>
        <p class="note">Track projects, assignments, and portfolio pieces that show growth.</p>
      </div>
      <div class="list-item">
        <strong>Measure readiness</strong>
        <p class="note">Use readiness plans to identify which steps move you toward entry-level routes.</p>
      </div>
    `;
  }
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
    renderCareerPathway(overview);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      renderAuthState(highlights, 'Odie Careers preview is warming up.');
      sourceGeneratedAt.textContent = 'Odie Careers preview is still being wired up in development mode.';
      return;
    }

    highlights.innerHTML = `
      <div class="empty-state">
        <strong>Odie Careers is temporarily unavailable.</strong>
        <p>${escapeHtml(error instanceof Error ? error.message : 'unknown_error')}</p>
      </div>
    `;
  }
}

bootstrap();
