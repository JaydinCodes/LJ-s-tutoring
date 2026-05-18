import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { resetDb } from './helpers/db.js';
import { pool } from '../src/db/pool.js';
import {
  createAdmin,
  createAssignment,
  createStudentUser,
  createTutor,
  issueMagicToken,
  loginWithMagicToken
} from './helpers/factories.js';

describe('Tutor portal end-to-end features', () => {
  beforeEach(async () => resetDb());
  afterAll(async () => pool.end());

  it('supports tutor application submission and admin approval audit fields', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { tutor, user } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Applicant' });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const save = await app.inject({
      method: 'PATCH',
      url: '/tutor/application',
      headers: tutorAuth.headers,
      payload: {
        personalDetails: { idNumber: '9001010000000' },
        subjects: ['Mathematics'],
        grades: ['Grade 10', 'Grade 11'],
        teachingPreferences: ['online'],
        experience: 'Two years tutoring algebra.',
        availabilityNotes: 'Weekday afternoons'
      }
    });
    expect(save.statusCode).toBe(200);

    const submit = await app.inject({ method: 'POST', url: '/tutor/application/submit', headers: tutorAuth.headers });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().application.status).toBe('submitted');

    const list = await app.inject({ method: 'GET', url: '/admin/tutor-applications', headers: adminAuth.headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().applications[0]).toMatchObject({ tutor_id: tutor.id, status: 'submitted' });

    const decision = await app.inject({
      method: 'POST',
      url: `/admin/tutor-applications/${submit.json().application.id}/decision`,
      headers: adminAuth.headers,
      payload: { status: 'approved', note: 'Meets requirements' }
    });
    expect(decision.statusCode).toBe(200);

    const profile = await pool.query(
      `select approval_status, approval_reviewed_by, approval_reviewed_at, approval_note
       from tutor_profiles where id = $1`,
      [tutor.id]
    );
    expect(profile.rows[0].approval_status).toBe('approved');
    expect(profile.rows[0].approval_reviewed_by).toBe(admin.id);
    expect(profile.rows[0].approval_reviewed_at).toBeTruthy();
    expect(profile.rows[0].approval_note).toBe('Meets requirements');
    await app.close();
  });

  it('enforces tutor document ownership and lets admins verify documents', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { user } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Docs' });
    const { user: otherUser } = await createTutor({ email: 'other@example.com', fullName: 'Other Tutor' });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));
    const otherAuth = await loginWithMagicToken(app, await issueMagicToken(otherUser.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const upload = await app.inject({
      method: 'POST',
      url: '/tutor/documents',
      headers: tutorAuth.headers,
      payload: {
        documentType: 'identity',
        originalFilename: 'id.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.4 test').toString('base64')
      }
    });
    expect(upload.statusCode).toBe(201);

    const otherDocs = await app.inject({ method: 'GET', url: '/tutor/documents', headers: otherAuth.headers });
    expect(otherDocs.statusCode).toBe(200);
    expect(otherDocs.json().documents).toHaveLength(0);

    const verify = await app.inject({
      method: 'PATCH',
      url: `/admin/tutor-documents/${upload.json().document.id}`,
      headers: adminAuth.headers,
      payload: { status: 'accepted', notes: 'Verified' }
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().document.verification_status).toBe('accepted');
    await app.close();
  });

  it('shares tutor-created learner assignments with student and admin dashboards', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { tutor, user } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Assign' });
    const { student, user: studentUser } = await createStudentUser({ email: 'student@example.com', fullName: 'Student One', grade: '10' });
    const teaching = await createAssignment({
      tutorId: tutor.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-01-01',
      allowedDays: [1, 2, 3],
      allowedTimeRanges: [{ start: '14:00', end: '18:00' }]
    });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(studentUser.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const create = await app.inject({
      method: 'POST',
      url: '/tutor/learning-assignments',
      headers: tutorAuth.headers,
      payload: {
        assignmentId: teaching.id,
        studentId: student.id,
        subject: 'Math',
        title: 'Linear equations practice',
        instructions: 'Complete questions 1-10.',
        dueDate: '2026-02-10'
      }
    });
    expect(create.statusCode).toBe(201);

    const studentView = await app.inject({ method: 'GET', url: '/student/learning-assignments', headers: studentAuth.headers });
    expect(studentView.statusCode).toBe(200);
    expect(studentView.json().assignments[0]).toMatchObject({ title: 'Linear equations practice' });

    const adminView = await app.inject({ method: 'GET', url: '/admin/learning-assignments', headers: adminAuth.headers });
    expect(adminView.statusCode).toBe(200);
    expect(adminView.json().assignments[0]).toMatchObject({ created_by_user_id: user.id, student_id: student.id });
    await app.close();
  });

  it('saves session reports, submits for approval, and feeds payout readiness', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { tutor, user } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Reports' });
    const { student } = await createStudentUser({ email: 'student@example.com', fullName: 'Student Report', grade: '10' });
    const teaching = await createAssignment({
      tutorId: tutor.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-01-01',
      allowedDays: [1, 2, 3, 4, 5],
      allowedTimeRanges: [{ start: '08:00', end: '18:00' }]
    });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const session = await app.inject({
      method: 'POST',
      url: '/tutor/sessions',
      headers: tutorAuth.headers,
      payload: {
        assignmentId: teaching.id,
        studentId: student.id,
        date: '2026-02-03',
        startTime: '09:00',
        endTime: '10:00',
        mode: 'online'
      }
    });
    const sessionId = session.json().session.id;

    const report = await app.inject({
      method: 'PATCH',
      url: `/tutor/sessions/${sessionId}/report`,
      headers: tutorAuth.headers,
      payload: {
        attendanceStatus: 'present',
        topicsCovered: 'Factorisation',
        learnerStruggles: 'Sign errors',
        homeworkAssigned: 'Worksheet A',
        studentSummary: 'Good progress on factorisation.',
        tutorPrivateNotes: 'Needs confidence.'
      }
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().session.homework_assigned).toBe('Worksheet A');

    const submit = await app.inject({ method: 'POST', url: `/tutor/sessions/${sessionId}/submit`, headers: tutorAuth.headers });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().session.status).toBe('SUBMITTED');

    const approve = await app.inject({ method: 'POST', url: `/admin/sessions/${sessionId}/approve`, headers: adminAuth.headers });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().session.status).toBe('APPROVED');

    const performance = await app.inject({ method: 'GET', url: '/admin/tutor-performance', headers: adminAuth.headers });
    expect(performance.statusCode).toBe(200);
    expect(performance.json().tutors[0].payout_ready_sessions).toBe(1);
    await app.close();
  });

  it('tracks volunteer hours separately from paid sessions', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { user } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Volunteer' });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(user.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const event = await app.inject({
      method: 'POST',
      url: '/admin/volunteer/events',
      headers: adminAuth.headers,
      payload: { title: 'Career day', eventDate: '2026-03-01', mode: 'in-person' }
    });
    expect(event.statusCode).toBe(201);

    const log = await app.inject({
      method: 'POST',
      url: '/tutor/volunteer/logs',
      headers: tutorAuth.headers,
      payload: { eventId: event.json().event.id, hours: 2.5, volunteeredOn: '2026-03-01', notes: 'Helped learners.' }
    });
    expect(log.statusCode).toBe(201);
    expect(log.json().log.status).toBe('submitted');

    const verify = await app.inject({
      method: 'POST',
      url: `/admin/volunteer/logs/${log.json().log.id}/verify`,
      headers: adminAuth.headers,
      payload: { status: 'verified', adminNote: 'Confirmed' }
    });
    expect(verify.statusCode).toBe(200);

    const perf = await app.inject({ method: 'GET', url: '/tutor/performance', headers: tutorAuth.headers });
    expect(perf.statusCode).toBe(200);
    expect(perf.json().performance.verifiedVolunteerHours).toBe(2.5);
    await app.close();
  });
});
