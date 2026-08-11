const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('core Supabase dashboards throw query errors instead of rendering plausible empty data', () => {
  const student = read('src/features/students/studentDashboardRepository.ts');
  const tutor = read('src/features/tutors/tutorDashboardRepository.ts');
  const tutorOperations = read('src/features/tutors/tutorOperationsRepository.ts');
  const admin = read('src/features/admin/adminDashboardRepository.ts');
  const storage = read('src/lib/supabase/storage.ts');

  assert.match(student, /authError[\s\S]*throw authError/);
  assert.match(student, /\[assignmentsResult, progressResult, competencyEvidenceResult, enrollmentsResult, submissionsResult, assignedTutorsResult, sessionsResult\][\s\S]*throw result\.error/);
  for (const result of ['profileResult', 'studentResult', 'classesResult', 'subjectsResult']) {
    assert.match(student, new RegExp(`if \\(${result}\\.error\\) \\{[\\s\\S]*?throw ${result}\\.error`));
  }
  assert.match(student, /rpc\('get_student_assigned_tutors'\)/);
  assert.doesNotMatch(student, /from\('tutor_student_allocations'\)/);
  assert.doesNotMatch(student, /from\('tutors'\)/);

  assert.match(tutor, /loadTutorAllocatedStudents\(client\)/);
  assert.match(tutorOperations, /rpc\('get_tutor_allocated_students'\)[\s\S]*if \(result\.error\) \{[\s\S]*?throw result\.error/);
  assert.doesNotMatch(tutor, /from\('students'\)/);
  assert.doesNotMatch(tutorOperations, /from\('students'\)/);
  assert.doesNotMatch(tutor + tutorOperations, /from\('profiles'\)\.select\('\*'\)\.in\('id'/);

  assert.match(admin, /\[studentsResult, guardiansResult, studentGuardiansResult, tutorsResult, assignmentsResult, submissionsResult, paymentsResult, tutorPaymentsResult, ngoResult\][\s\S]*throw result\.error/);
  assert.match(admin, /if \(profilesResult\.error\) \{[\s\S]*?throw profilesResult\.error/);
  assert.match(storage, /createSignedUrls[\s\S]*if \(result\.error\) \{[\s\S]*throw result\.error/);
  assert.match(storage, /entry\.error[\s\S]*!entry\.path[\s\S]*!entry\.signedUrl/);
  assert.match(storage, /!expectedPaths\.has\(entry\.path\)[\s\S]*map\.has\(entry\.path\)/);
  assert.match(storage, /map\.size !== expectedPaths\.size[\s\S]*throw signedUrlFailure/);
  assert.doesNotMatch(storage, /throw new Error\([^)]*entry\.(?:error|path)/, 'signed URL failures must not expose object paths or provider detail');
});
