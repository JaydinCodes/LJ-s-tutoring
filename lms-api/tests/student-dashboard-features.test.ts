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

describe('Student dashboard LMS features', () => {
  beforeEach(async () => resetDb());
  afterAll(async () => pool.end());

  it('returns the signed-in student profile, academic profile, assigned tutor, baseline, goals, risk band, attendance, and latest report', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { tutor, user: tutorUser } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor One' });
    const { student, user: studentUser } = await createStudentUser({ email: 'student@example.com', fullName: 'Student One', grade: 'Grade 10' });
    await pool.query(
      `update students
       set school = 'Odysseus High',
           subjects_json = $2::jsonb,
           guardian_name = 'Guardian One',
           guardian_relationship = 'Parent',
           guardian_email = 'guardian@example.com',
           partner_affiliation = 'ProVision'
       where id = $1`,
      [student.id, JSON.stringify(['Mathematics', 'Physical Sciences'])]
    );
    const teaching = await createAssignment({
      tutorId: tutor.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-01-01',
      allowedDays: [1, 2, 3, 4, 5],
      allowedTimeRanges: [{ start: '08:00', end: '18:00' }]
    });
    await pool.query(`insert into tutor_student_map (tutor_id, student_id) values ($1, $2) on conflict do nothing`, [tutor.id, student.id]);

    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(studentUser.id));
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(tutorUser.id));

    const baseline = await app.inject({
      method: 'POST',
      url: '/admin/baseline-assessments',
      headers: adminAuth.headers,
      payload: {
        studentId: student.id,
        subject: 'Math',
        grade: 'Grade 10',
        score: 34,
        total: 50,
        levelBand: 'Developing',
        topicBreakdown: { algebra: 55 },
        recommendedNextSteps: ['Revise linear equations'],
        completedAt: '2026-02-01T10:00:00.000Z',
        sourceType: 'diagnostic'
      }
    });
    expect(baseline.statusCode).toBe(201);

    const goal = await app.inject({
      method: 'POST',
      url: '/admin/learning-goals',
      headers: adminAuth.headers,
      payload: {
        studentId: student.id,
        title: 'Improve algebra baseline',
        category: 'academic',
        subject: 'Math',
        targetValue: 80,
        currentValue: 68,
        dueDate: '2026-03-01'
      }
    });
    expect(goal.statusCode).toBe(201);

    await pool.query(
      `insert into student_score_snapshots
       (user_id, score_date, risk_score, momentum_score, reasons_json, metrics_json, recommended_actions_json)
       values ($1, '2026-02-02'::date, 72, 45, $2::jsonb, '{}'::jsonb, $3::jsonb)`,
      [
        studentUser.id,
        JSON.stringify([{ detail: 'Baseline below target' }]),
        JSON.stringify([{ label: 'Review algebra with tutor' }])
      ]
    );

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
    await app.inject({
      method: 'PATCH',
      url: `/tutor/sessions/${sessionId}/report`,
      headers: tutorAuth.headers,
      payload: { attendanceStatus: 'present', topicsCovered: 'Algebra', studentSummary: 'Worked on equations.' }
    });
    await app.inject({ method: 'POST', url: `/tutor/sessions/${sessionId}/submit`, headers: tutorAuth.headers });
    await app.inject({ method: 'POST', url: `/admin/sessions/${sessionId}/approve`, headers: adminAuth.headers });
    await app.inject({ method: 'POST', url: '/reports/generate', headers: studentAuth.headers, payload: {} });

    const dashboard = await app.inject({ method: 'GET', url: '/dashboard', headers: studentAuth.headers });
    expect(dashboard.statusCode).toBe(200);
    const body = dashboard.json();
    expect(body.profile).toMatchObject({
      name: 'Student One',
      school: 'Odysseus High',
      partnerAffiliation: 'ProVision'
    });
    expect(body.profile.guardian).toMatchObject({ name: 'Guardian One', relationship: 'Parent' });
    expect(body.academicProfile.enrolledSubjects).toContain('Mathematics');
    expect(body.assignedTutors[0]).toMatchObject({ full_name: 'Tutor One', subject: 'Math' });
    expect(body.baseline).toMatchObject({ subject: 'Math', percentage: 68 });
    expect(body.supportStatus.band).toBe('urgent_support');
    expect(body.goals[0]).toMatchObject({ title: 'Improve algebra baseline' });
    expect(body.attendance.items[0]).toMatchObject({ attendance_status: 'present' });
    expect(body.latestReport).toBeTruthy();
    expect(body.notificationsUnreadCount).toBeGreaterThan(0);
    expect(body.notifications.some((notification: any) => notification.type === 'baseline_assessment_created')).toBe(true);
    expect(body.notifications.some((notification: any) => notification.type === 'learning_goal_created')).toBe(true);
    expect(body.notifications.some((notification: any) => notification.type === 'session_report_submitted')).toBe(true);
    expect(body.notifications.some((notification: any) => notification.type === 'weekly_report_ready')).toBe(true);

    const notificationList = await app.inject({ method: 'GET', url: '/student/notifications', headers: studentAuth.headers });
    expect(notificationList.statusCode).toBe(200);
    const notificationBody = notificationList.json();
    expect(notificationBody.unreadCount).toBe(body.notificationsUnreadCount);
    expect(notificationBody.notifications.length).toBeGreaterThan(0);

    const firstNotificationId = notificationBody.notifications[0].id;
    const markedRead = await app.inject({
      method: 'PATCH',
      url: `/student/notifications/${firstNotificationId}/read`,
      headers: studentAuth.headers
    });
    expect(markedRead.statusCode).toBe(200);

    const afterRead = await app.inject({ method: 'GET', url: '/student/notifications', headers: studentAuth.headers });
    expect(afterRead.statusCode).toBe(200);
    const afterReadBody = afterRead.json();
    expect(afterReadBody.unreadCount).toBe(notificationBody.unreadCount - 1);
    expect(afterReadBody.notifications.find((notification: any) => notification.id === firstNotificationId).is_read).toBe(true);
    await app.close();
  });

  it('prevents a student from reading another learner profile by changing the id', async () => {
    const app = await buildApp();
    const { student: ownStudent, user } = await createStudentUser({ email: 'student@example.com', fullName: 'Own Student', grade: 'Grade 9' });
    const { student: otherStudent } = await createStudentUser({ email: 'other@example.com', fullName: 'Other Student', grade: 'Grade 9' });
    const auth = await loginWithMagicToken(app, await issueMagicToken(user.id));

    const own = await app.inject({ method: 'GET', url: `/student/profile/${ownStudent.id}`, headers: auth.headers });
    expect(own.statusCode).toBe(200);

    const other = await app.inject({ method: 'GET', url: `/student/profile/${otherStudent.id}`, headers: auth.headers });
    expect(other.statusCode).toBe(403);
    await app.close();
  });

  it('allows assigned tutors to view learner summaries and blocks unassigned tutors', async () => {
    const app = await buildApp();
    const { tutor, user: tutorUser } = await createTutor({ email: 'tutor@example.com', fullName: 'Assigned Tutor' });
    const { user: otherTutorUser } = await createTutor({ email: 'other-tutor@example.com', fullName: 'Other Tutor' });
    const { student } = await createStudentUser({ email: 'student@example.com', fullName: 'Learner', grade: 'Grade 10' });
    await createAssignment({
      tutorId: tutor.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-01-01',
      allowedDays: [1, 2, 3],
      allowedTimeRanges: [{ start: '14:00', end: '18:00' }]
    });

    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(tutorUser.id));
    const otherAuth = await loginWithMagicToken(app, await issueMagicToken(otherTutorUser.id));

    const allowed = await app.inject({ method: 'GET', url: `/tutor/students/${student.id}/summary`, headers: tutorAuth.headers });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().profile.name).toBe('Learner');

    const blocked = await app.inject({ method: 'GET', url: `/tutor/students/${student.id}/summary`, headers: otherAuth.headers });
    expect(blocked.statusCode).toBe(403);
    await app.close();
  });

  it('keeps tutor-created learner assignments visible to student and admin assignment overviews', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const { tutor, user: tutorUser } = await createTutor({ email: 'tutor@example.com', fullName: 'Tutor Assign' });
    const { student, user: studentUser } = await createStudentUser({ email: 'student@example.com', fullName: 'Student Assign', grade: 'Grade 10' });
    const teaching = await createAssignment({
      tutorId: tutor.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-01-01',
      allowedDays: [1, 2, 3],
      allowedTimeRanges: [{ start: '14:00', end: '18:00' }]
    });
    const tutorAuth = await loginWithMagicToken(app, await issueMagicToken(tutorUser.id));
    const studentAuth = await loginWithMagicToken(app, await issueMagicToken(studentUser.id));
    const adminAuth = await loginWithMagicToken(app, await issueMagicToken(admin.id));

    const created = await app.inject({
      method: 'POST',
      url: '/tutor/learning-assignments',
      headers: tutorAuth.headers,
      payload: {
        assignmentId: teaching.id,
        studentId: student.id,
        subject: 'Math',
        title: 'Quadratics practice',
        dueDate: '2026-03-05'
      }
    });
    expect(created.statusCode).toBe(201);

    const studentView = await app.inject({ method: 'GET', url: '/student/assignments', headers: studentAuth.headers });
    expect(studentView.statusCode).toBe(200);
    expect(studentView.json().assignments[0]).toMatchObject({ title: 'Quadratics practice' });

    const adminView = await app.inject({ method: 'GET', url: '/admin/learning-assignments', headers: adminAuth.headers });
    expect(adminView.statusCode).toBe(200);
    expect(adminView.json().assignments[0]).toMatchObject({ student_id: student.id, created_by_user_id: tutorUser.id });
    await app.close();
  });
});
