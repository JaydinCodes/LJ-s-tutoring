const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261116120000_learning_privacy_coverage.sql'), 'utf8');
const manifest = migration.split('$$;')[0];

test('all newer learner-owned learning tables are explicitly covered by the privacy manifest', () => {
  const migrationRoot = path.join(root, 'supabase/migrations');
  for (const name of fs.readdirSync(migrationRoot).filter((entry) => /^2026(08(2[6-9]|3\d)|09|10|11).*\.sql$/.test(entry))) {
    const sql = fs.readFileSync(path.join(migrationRoot, name), 'utf8');
    for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (/student_id\s+uuid[^\n]*references public\.students/i.test(match[2])) {
        assert.ok(manifest.includes(`('${match[1]}',`), `${match[1]} needs export, erasure and retention coverage`);
      }
    }
  }
});

test('privacy export and trusted deletion share an ordered, private manifest', () => {
  assert.match(migration, /'learning_records', private\.export_student_learning_data\(p_student_id\)/);
  assert.match(migration, /v_counts := private\.erase_student_privacy_data_before_learning\(p_request_id\) \|\| v_learning_counts/);
  assert.match(migration, /processing_state <> 'storage_deleted'/);
  assert.match(migration, /manifest_version', 'PRIV-02-learning-v1'/);
  assert.match(migration, /grant execute on function public\.erase_student_privacy_data\(uuid\) to service_role/);
  assert.match(migration, /revoke all on function public\.anonymize_student\(uuid\) from public, anon, authenticated, service_role/);
  assert.ok(manifest.indexOf("('topic_mastery_evaluation_evidence'") < manifest.indexOf("('topic_mastery_evaluations'"));
  assert.ok(manifest.indexOf("('learning_assessment_session_question_results'") < manifest.indexOf("('learning_assessment_sessions'"));
  assert.ok(manifest.indexOf("('skill_mastery_evaluation_evidence'") < manifest.indexOf("('learning_attempts'"));
});

test('retention defaults remain unchanged and live evidence holds its source submission', () => {
  assert.match(migration, /v_latest < v_academic_cut/);
  assert.match(migration, /'learning_inactivity', 3/);
  assert.match(migration, /if p_apply then[\s\S]*private\.erase_student_learning_data/);
  assert.match(migration, /not exists \(select 1 from public\.qualifying_assignment_mastery_evidence evidence where evidence\.assignment_submission_id = submission\.id\)/);
});

test('batch publication retains admin authority and separate formal academic evidence', () => {
  const release = fs.readFileSync(path.join(root, 'supabase/migrations/20261116130000_grade9_batch_content_release.sql'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src/features/admin/AdminLearningContentRoute.tsx'), 'utf8');
  assert.match(release, /perform public\.content_admin_required\(\)/);
  assert.match(release, /p_include_formal boolean default false/);
  assert.match(release, /formal_academic_signoff_reference_required/);
  assert.match(release, /grade9_release_preview_stale/);
  assert.match(release, /public\.publish_learning_assessment_form/);
  assert.match(page, /Preview release/);
  assert.match(page, /Publish reviewed pack/);
});
