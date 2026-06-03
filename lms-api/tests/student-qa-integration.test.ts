import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { resetDb } from './helpers/db.js';
import {
  createAdmin,
  createAssignment,
  createStudentUser,
  createTutor,
  issueMagicToken,
  loginWithMagicToken,
} from './helpers/factories.js';

function multipartFilePayload(filename: string, mimetype: string, content: string) {
  const boundary = `qa-boundary-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: ${mimetype}\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Student QA integration coverage', () => {
  beforeEach(async () => resetDb());
  afterAll(async () => pool.end());

  it('keeps student assignment access scoped to the signed-in learner', async () => {
    const app = await buildApp();
    const admin = await createAdmin('qa-admin@example.com');
    const { tutor } = await createTutor({ email: 'qa-tutor@example.com', fullName: 'QA Tutor' });
    const { student: ownStudent, user: ownUser } = await createStudentUser({ email: 'qa-own@example.com', fullName: 'Own Learner', grade: 'Grade 10' });
    const { student: otherStudent } = await createStudentUser({ email: 'qa-other@example.com', fullName: 'Other Learner', grade: 'Grade 10' });
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(ownUser.id));

    await createAssignment({ tutorId: tutor.id, studentId: ownStudent.id, subject: 'Math', startDate: '2026-02-01' });
    await createAssignment({ tutorId: tutor.id, studentId: otherStudent.id, subject: 'Math', startDate: '2026-02-01' });

    const ownAssignment = await app.inject({
      method: 'POST',
      url: '/admin/learning-assignments',
      headers: adminAuth.headers,
      payload: {
        tutorId: tutor.id,
        studentId: ownStudent.id,
        subject: 'Math',
        title: 'Own algebra pack',
        description: 'Visible only to the signed-in learner.',
        dueDate: '2026-03-01',
        status: 'published',
      },
    });
    expect(ownAssignment.statusCode).toBe(201);

    const otherAssignment = await app.inject({
      method: 'POST',
      url: '/admin/learning-assignments',
      headers: adminAuth.headers,
      payload: {
        tutorId: tutor.id,
        studentId: otherStudent.id,
        subject: 'Math',
        title: 'Other learner pack',
        description: 'Must not leak to the signed-in learner.',
        dueDate: '2026-03-01',
        status: 'published',
      },
    });
    expect(otherAssignment.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/student/assignments', headers: studentAuth.headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().assignments).toHaveLength(1);
    expect(list.json().assignments[0]).toMatchObject({ title: 'Own algebra pack', id: ownAssignment.json().assignment.id });
    expect(JSON.stringify(list.json())).not.toContain('Other learner pack');

    const upload = multipartFilePayload('proof.pdf', 'application/pdf', '%PDF-qa');
    const blockedSubmission = await app.inject({
      method: 'POST',
      url: `/student/assignments/${otherAssignment.json().assignment.id}/submissions`,
      headers: { ...studentAuth.headers, 'content-type': upload.contentType },
      payload: upload.body,
    });
    expect(blockedSubmission.statusCode).toBe(404);
    expect(blockedSubmission.json().error).toBe('assignment_not_found');

    await app.close();
  });

  it('rejects uploads to closed assignments before writing a submission row', async () => {
    const app = await buildApp();
    const admin = await createAdmin('qa-admin@example.com');
    const { tutor } = await createTutor({ email: 'qa-tutor@example.com', fullName: 'QA Tutor' });
    const { student, user } = await createStudentUser({ email: 'qa-student@example.com', fullName: 'Closed Learner', grade: 'Grade 10' });
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));

    await createAssignment({ tutorId: tutor.id, studentId: student.id, subject: 'Physics', startDate: '2026-02-01' });
    const assignment = await app.inject({
      method: 'POST',
      url: '/admin/learning-assignments',
      headers: adminAuth.headers,
      payload: {
        tutorId: tutor.id,
        studentId: student.id,
        subject: 'Physics',
        title: 'Closed practical',
        description: 'No more uploads.',
        dueDate: '2026-03-01',
        status: 'published',
      },
    });
    expect(assignment.statusCode).toBe(201);
    await pool.query(`update learning_assignments set status = 'closed' where id = $1`, [assignment.json().assignment.id]);

    const upload = multipartFilePayload('closed.pdf', 'application/pdf', '%PDF-closed');
    const response = await app.inject({
      method: 'POST',
      url: `/student/assignments/${assignment.json().assignment.id}/submissions`,
      headers: { ...studentAuth.headers, 'content-type': upload.contentType },
      payload: upload.body,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'assignment_locked' });

    const submissions = await pool.query(`select id from assignment_submissions where assignment_id = $1`, [assignment.json().assignment.id]);
    expect(Number(submissions.rowCount || 0)).toBe(0);

    await app.close();
  });

  it('returns marked results and updates topic analytics after result release', async () => {
    const app = await buildApp();
    const admin = await createAdmin('qa-admin@example.com');
    const { student, user } = await createStudentUser({ email: 'qa-results@example.com', fullName: 'Results Learner', grade: 'Grade 11' });
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));

    const released = await app.inject({
      method: 'POST',
      url: '/admin/baseline-assessments',
      headers: adminAuth.headers,
      payload: {
        studentId: student.id,
        subject: 'Mathematics',
        grade: 'Grade 11',
        score: 78,
        total: 100,
        levelBand: 'Strong progress',
        topicBreakdown: { Algebra: { score: 82 }, Geometry: { score: 64 } },
        cognitiveBreakdown: { Knowledge: { score: 80 }, 'Problem Solving': { score: 58 } },
        recommendedNextSteps: ['Practise geometry problem solving'],
        completedAt: '2026-05-01T10:00:00.000Z',
        sourceType: 'exam',
      },
    });
    expect(released.statusCode).toBe(201);

    const results = await app.inject({ method: 'GET', url: '/student/results', headers: studentAuth.headers });
    expect(results.statusCode).toBe(200);
    expect(results.json().items[0]).toMatchObject({ subject: 'Mathematics', percentage: 78, levelBand: 'Strong progress' });

    const analytics = await app.inject({ method: 'GET', url: '/student/results/analytics', headers: studentAuth.headers });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().topicAverages).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: 'Mathematics', topic: 'Algebra', average: 82 }),
      expect.objectContaining({ subject: 'Mathematics', topic: 'Geometry', average: 64 }),
    ]));

    await app.close();
  });

  it('persists quiz attempt metadata through the current study activity endpoint', async () => {
    const app = await buildApp();
    const { user } = await createStudentUser({ email: 'qa-quiz@example.com', fullName: 'Quiz Learner', grade: 'Grade 10' });
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));

    const response = await app.inject({
      method: 'POST',
      url: '/study-activity',
      headers: studentAuth.headers,
      payload: {
        type: 'practice_completed',
        dedupeKey: 'quiz-attempt-qa-0001',
        metadata: {
          quizId: 'quiz-algebra-focus',
          topic: 'Algebra',
          score: 7,
          total: 10,
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, credited: true });

    // Until a dedicated quiz_attempts table exists, quiz completions are stored as study activity metadata.
    const stored = await pool.query(
      `select type, metadata_json from study_activity_events where user_id = $1 and dedupe_key = $2`,
      [user.id, 'quiz-attempt-qa-0001']
    );
    expect(stored.rows[0]).toMatchObject({ type: 'practice_completed' });
    expect(stored.rows[0].metadata_json).toMatchObject({ quizId: 'quiz-algebra-focus', topic: 'Algebra', score: 7, total: 10 });

    await app.close();
  });
});
