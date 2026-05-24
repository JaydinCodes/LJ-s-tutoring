import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import {
  createTutor,
  listTutors,
  updateTutor,
  startImpersonation,
  stopImpersonation
} from '../domains/admin/tutors/index.js';
import {
  createStudent,
  listStudents,
  updateStudent
} from '../domains/admin/students/index.js';
import {
  createAssignment,
  listAssignments,
  updateAssignment
} from '../domains/admin/assignments/index.js';
import {
  listSessions,
  getSessionHistory,
  bulkApprove,
  bulkReject,
  approveSession,
  rejectSession
} from '../domains/admin/approvals/index.js';
import {
  generatePayrollWeek,
  lockPayPeriod,
  createAdjustment,
  listAdjustments,
  deleteAdjustment
} from '../domains/admin/payroll/index.js';
import {
  AdminSessionsQuerySchema,
  AssignmentSchema,
  AuditLogQuerySchema,
  PrivacyRequestCreateSchema,
  PrivacyRequestQuerySchema,
  PrivacyRequestCloseSchema,
  BulkApproveSessionsSchema,
  BulkRejectSessionsSchema,
  CreateStudentSchema,
  CreateTutorSchema,
  DeleteAdjustmentSchema,
  ImpersonateStartSchema,
  ImpersonateStopSchema,
  AdjustmentCreateSchema,
  IdParamSchema,
  PayrollGenerateSchema,
  RejectSessionSchema,
  WeekStartParamSchema,
  UpdateAssignmentSchema,
  UpdateStudentSchema,
  UpdateTutorSchema,
  BaselineAssessmentSchema,
  LearningGoalSchema,
  UpdateLearningGoalSchema,
  TutorApplicationDecisionSchema,
  TutorDocumentVerifySchema,
  VolunteerEventSchema,
  VolunteerLogVerifySchema
} from '../lib/schemas.js';
import { requireAuth, requireRole } from '../lib/rbac.js';
import { getPayPeriodRange, getPayPeriodStart } from '../lib/pay-periods.js';
import { isWithinAssignmentWindow } from '../lib/scheduling.js';
import { safeAuditMeta, writeAuditLog } from '../lib/audit.js';
import { getRetentionConfig, getRetentionCutoffs } from '../lib/retention.js';
import { anonymizeStudent, anonymizeTutor, exportStudentData, exportTutorData } from '../lib/privacy.js';
import { PII_CLASSIFICATION_MAP } from '../lib/data-classification.js';
import { parsePagination } from '../lib/pagination.js';
import { enqueueJob, getJob } from '../lib/job-queue.js';
import { getErrorMonitor } from '../lib/error-monitor.js';
import { createStudentNotification } from '../lib/notifications.js';
import { supportBandFromRiskScore } from '../lib/support-band.js';


function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

const AdminLearningAssignmentSchema = z.object({
  tutorId: z.string().uuid(),
  studentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['draft', 'published']).default('draft'),
});

const AdminLearningAssignmentPatchSchema = AdminLearningAssignmentSchema.partial().omit({
  tutorId: true,
  studentId: true,
});

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireRole('ADMIN'));

  const impersonationCookieOptions = () => {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: isProd,
      path: '/',
      maxAge: 60 * 10
    };
  };

  const normalizeJson = (value: any) => {
    if (value == null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const logAuditSafe = async (client: any, entry: Parameters<typeof writeAuditLog>[1]) => {
    try {
      await writeAuditLog(client, entry);
    } catch (err) {
      app.log?.error?.(err);
    }
  };

  const shouldLogAlert = async (action: string, adminId: string, windowMinutes: number) => {
    const res = await pool.query(
      `select 1
       from audit_log
       where actor_user_id = $1
         and action = $2
         and created_at >= now() - ($3 * interval '1 minute')
       limit 1`,
      [adminId, action, windowMinutes]
    );
    return res.rowCount === 0;
  };

  const maybeLogAlert = async (action: string, adminId: string, windowMinutes: number, meta: any, context: any) => {
    try {
      const ok = await shouldLogAlert(action, adminId, windowMinutes);
      if (!ok) return;
      await logAuditSafe(pool, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action,
        entityType: 'alert',
        entityId: adminId,
        meta: safeAuditMeta(meta),
        ip: context.ip,
        userAgent: context.userAgent,
        correlationId: context.correlationId,
      });
    } catch (err) {
      app.log?.error?.(err);
    }
  };

  const checkApprovalAlerts = async (adminId: string, context: any) => {
    const ratioRes = await pool.query(
      `select
        count(*) filter (where change_type = 'approve') as approvals,
        count(*) filter (where change_type = 'reject') as rejections
       from session_history
       where changed_by_user_id = $1
         and created_at >= now() - interval '1 hour'`,
      [adminId]
    );
    const approvals = Number(ratioRes.rows[0]?.approvals || 0);
    const rejections = Number(ratioRes.rows[0]?.rejections || 0);
    const total = approvals + rejections;
    if (total >= 20) {
      const rejectionRatio = total > 0 ? rejections / total : 0;
      if (rejectionRatio >= 0.8 || rejectionRatio <= 0.05) {
        await maybeLogAlert('alert.approval_ratio', adminId, 60, {
          approvals,
          rejections,
          total,
          rejectionRatio,
          windowMinutes: 60
        }, context);
      }
    }

    const overrideRes = await pool.query(
      `select count(*) as count
       from session_history
       where changed_by_user_id = $1
         and change_type in ('approve', 'reject')
         and created_at >= now() - interval '10 minutes'`,
      [adminId]
    );
    const overrideCount = Number(overrideRes.rows[0]?.count || 0);
    if (overrideCount >= 30) {
      await maybeLogAlert('alert.admin_override_spike', adminId, 10, {
        approvalsAndRejections: overrideCount,
        windowMinutes: 10
      }, context);
    }
  };

  const checkPayrollAdjustmentAlerts = async (adminId: string, context: any) => {
    const res = await pool.query(
      `select
        count(*) filter (where created_by_user_id = $1 and created_at >= now() - interval '1 hour') as created_count,
        count(*) filter (where voided_by_user_id = $1 and voided_at >= now() - interval '1 hour') as voided_count
       from adjustments`,
      [adminId]
    );
    const createdCount = Number(res.rows[0]?.created_count || 0);
    const voidedCount = Number(res.rows[0]?.voided_count || 0);
    const total = createdCount + voidedCount;
    if (total >= 5) {
      await maybeLogAlert('alert.payroll_adjustment_spike', adminId, 60, {
        createdCount,
        voidedCount,
        total,
        windowMinutes: 60
      }, context);
    }
  };

  const buildAuditFilters = (data: {
    from?: string;
    to?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
  }) => {
    const params: any[] = [];
    const filters: string[] = [];
    if (data.from) {
      params.push(data.from);
      filters.push(`a.created_at >= $${params.length}::timestamptz`);
    }
    if (data.to) {
      params.push(`${data.to} 23:59:59`);
      filters.push(`a.created_at <= $${params.length}::timestamptz`);
    }
    if (data.actorId) {
      params.push(data.actorId);
      filters.push(`a.actor_user_id = $${params.length}`);
    }
    if (data.entityType) {
      params.push(data.entityType);
      filters.push(`a.entity_type = $${params.length}`);
    }
    if (data.entityId) {
      params.push(data.entityId);
      filters.push(`a.entity_id = $${params.length}`);
    }

    return {
      params,
      where: filters.length ? `where ${filters.join(' and ')}` : ''
    };
  };


  const applyTutorCorrection = async (client: any, tutorId: string, payload: any) => {
    const currentRes = await client.query(`select * from tutor_profiles where id = $1`, [tutorId]);
    if (currentRes.rowCount === 0) return null;
    const current = currentRes.rows[0];

    const res = await client.query(
      `update tutor_profiles
       set full_name = $1,
           phone = $2,
           default_hourly_rate = $3,
           active = $4
       where id = $5
       returning id, full_name, phone, default_hourly_rate, active`,
      [
        payload.fullName ?? current.full_name,
        payload.phone ?? current.phone,
        payload.defaultHourlyRate ?? current.default_hourly_rate,
        payload.active ?? current.active,
        tutorId
      ]
    );
    return res.rows[0];
  };

  const applyStudentCorrection = async (client: any, studentId: string, payload: any) => {
    const currentRes = await client.query(`select * from students where id = $1`, [studentId]);
    if (currentRes.rowCount === 0) return null;
    const current = currentRes.rows[0];

    const res = await client.query(
      `update students
       set full_name = $1,
           grade = $2,
           school = $3,
           subjects_json = $4::jsonb,
           guardian_name = $5,
           guardian_relationship = $6,
           guardian_phone = $7,
           guardian_email = $8,
           guardian_address = $9,
           partner_affiliation = $10,
           notes = $11,
           is_active = $12
       where id = $13
       returning id, full_name, grade, school, subjects_json, guardian_name, guardian_relationship,
                 guardian_phone, guardian_email, guardian_address, partner_affiliation, notes, is_active as active`,
      [
        payload.fullName ?? current.full_name,
        payload.grade ?? current.grade,
        payload.school ?? current.school,
        payload.subjects ? JSON.stringify(payload.subjects) : current.subjects_json,
        payload.guardianName ?? current.guardian_name,
        payload.guardianRelationship ?? current.guardian_relationship,
        payload.guardianPhone ?? current.guardian_phone,
        payload.guardianEmail ?? current.guardian_email,
        payload.guardianAddress ?? current.guardian_address,
        payload.partnerAffiliation ?? current.partner_affiliation,
        payload.notes ?? current.notes,
        payload.active ?? current.is_active,
        studentId
      ]
    );
    return res.rows[0];
  };

  const canDeleteTutor = async (client: any, tutorId: string) => {
    const cutoffs = getRetentionCutoffs(new Date());
    const recentSession = await client.query(
      `select 1 from sessions where tutor_id = $1 and date >= $2::date limit 1`,
      [tutorId, cutoffs.sessionsBefore]
    );
    if ((recentSession.rowCount ?? 0) > 0) return false;

    const recentInvoice = await client.query(
      `select 1 from invoices where tutor_id = $1 and period_end >= $2::date limit 1`,
      [tutorId, cutoffs.invoicesBefore]
    );
    if ((recentInvoice.rowCount ?? 0) > 0) return false;

    const invoiceLine = await client.query(
      `select 1
       from invoice_lines l
       join sessions s on s.id = l.session_id
       where s.tutor_id = $1
       limit 1`,
      [tutorId]
    );
    return invoiceLine.rowCount === 0;
  };

  const canDeleteStudent = async (client: any, studentId: string) => {
    const cutoffs = getRetentionCutoffs(new Date());
    const recentSession = await client.query(
      `select 1 from sessions where student_id = $1 and date >= $2::date limit 1`,
      [studentId, cutoffs.sessionsBefore]
    );
    if ((recentSession.rowCount ?? 0) > 0) return false;

    const invoiceLine = await client.query(
      `select 1
       from invoice_lines l
       join sessions s on s.id = l.session_id
       where s.student_id = $1
       limit 1`,
      [studentId]
    );
    return invoiceLine.rowCount === 0;
  };


  app.get('/admin/dashboard', async (req, reply) => {
    try {
      const [tutors, students, sessions] = await Promise.all([
        pool.query(`select count(*) from tutor_profiles where active = true`),
        pool.query(`select count(*) from students where is_active = true`),
        pool.query(`select status, count(*) from sessions group by status`)
      ]);

      return reply.send({
        tutors: Number(tutors.rows[0].count),
        students: Number(students.rows[0].count),
        sessions: sessions.rows
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/retention/summary', async (req, reply) => {
    try {
      const cutoffs = getRetentionCutoffs(new Date());
      const config = getRetentionConfig();

      const [
        magicLinkRes,
        auditRes,
        historyRes,
        invoiceRes,
        sessionRes,
        requestRes
      ] = await Promise.all([
        pool.query(`select count(*) as count from magic_link_tokens where expires_at < $1`, [cutoffs.magicLinkBefore]),
        pool.query(`select count(*) as count from audit_log where created_at < $1`, [cutoffs.auditBefore]),
        pool.query(`select count(*) as count from session_history where created_at < $1`, [cutoffs.sessionHistoryBefore]),
        pool.query(`select count(*) as count from invoices where period_end < $1::date`, [cutoffs.invoicesBefore]),
        pool.query(`select count(*) as count from sessions where date < $1::date`, [cutoffs.sessionsBefore]),
        pool.query(`select count(*) as count from privacy_requests where created_at < $1`, [cutoffs.privacyRequestsBefore])
      ]);

      const latestEventRes = await pool.query(
        `select id, ran_at, summary_json
         from retention_events
         order by ran_at desc
         limit 1`
      );
      const latestEvent = latestEventRes.rowCount
        ? {
            id: latestEventRes.rows[0].id,
            ranAt: latestEventRes.rows[0].ran_at,
            summary: latestEventRes.rows[0].summary_json
          }
        : null;

      return reply.send({
        config,
        cutoffs,
        latestEvent,
        eligible: {
          magicLinkTokens: Number(magicLinkRes.rows[0].count),
          auditLogs: Number(auditRes.rows[0].count),
          sessionHistory: Number(historyRes.rows[0].count),
          invoices: Number(invoiceRes.rows[0].count),
          sessions: Number(sessionRes.rows[0].count),
          privacyRequests: Number(requestRes.rows[0].count)
        }
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/tutors', async (req, reply) => {
    const parsed = CreateTutorSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const client = await pool.connect();
    try {
      const result = await createTutor(client, parsed.data);
      if ('error' in result) {
        return reply.code(409).send({ error: result.error, invalidSubjects: result.invalidSubjects });
      }
      return reply.code(201).send(result);
    } catch (err: any) {
      if (err?.code === '23505') return reply.code(409).send({ error: 'email_already_exists' });
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/admin/tutors', async (req, reply) => {
    try {
      const result = await listTutors(pool, req.query as any);
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/admin/tutors/:id', async (req, reply) => {
    const tutorId = (req.params as { id: string }).id;
    const parsed = UpdateTutorSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const updated = await updateTutor(pool, tutorId, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'tutor_not_found' });
      if ('error' in updated) {
        return reply.code(409).send({ error: updated.error, invalidSubjects: updated.invalidSubjects });
      }
      return reply.send({ tutor: updated });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/students', async (req, reply) => {
    const parsed = CreateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const student = await createStudent(client, parsed.data);
      await client.query('commit');
      return reply.code(201).send({ student });
    } catch (err: any) {
      await client.query('rollback').catch(() => undefined);
      if (err?.code === '23505') {
        return reply.code(409).send({ error: 'student_account_exists' });
      }
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/admin/tutor-applications', async (_req, reply) => {
    try {
      const res = await pool.query(
        `select ta.*, t.full_name, u.email, reviewer.email as reviewed_by_email
         from tutor_applications ta
         join tutor_profiles t on t.id = ta.tutor_id
         left join users u on u.tutor_profile_id = t.id
         left join users reviewer on reviewer.id = ta.reviewed_by
         order by ta.updated_at desc`
      );
      return reply.send({ applications: res.rows, items: res.rows });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: _req.id, userId: _req.user?.userId, role: _req.user?.role });
      _req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/tutors/:id/application', async (req, reply) => {
    const tutorId = (req.params as { id: string }).id;
    try {
      const [application, documents, availability] = await Promise.all([
        pool.query(
          `select ta.*, t.full_name, t.approval_status, t.approval_reviewed_at, t.approval_note
           from tutor_profiles t
           left join tutor_applications ta on ta.tutor_id = t.id
           where t.id = $1`,
          [tutorId]
        ),
        pool.query(
          `select id, document_type, original_filename, mime_type, file_size_bytes, uploaded_at,
                  verification_status, verified_by, verified_at, notes
           from tutor_documents where tutor_id = $1 order by uploaded_at desc`,
          [tutorId]
        ),
        pool.query(
          `select id, day_of_week, start_time, end_time, mode, notes, active
           from tutor_availability_slots where tutor_id = $1 order by day_of_week asc, start_time asc`,
          [tutorId]
        )
      ]);
      if (Number(application.rowCount || 0) === 0) return reply.code(404).send({ error: 'tutor_not_found' });
      return reply.send({ application: application.rows[0], documents: documents.rows, availability: availability.rows });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/tutor-applications/:id/decision', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = TutorApplicationDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const adminId = req.user!.userId;
    const client = await pool.connect();
    try {
      await client.query('begin');
      const appRes = await client.query(
        `update tutor_applications
         set status = $1, reviewed_by = $2, reviewed_at = now(), review_note = $3, updated_at = now()
         where id = $4
         returning *`,
        [parsed.data.status, adminId, parsed.data.note ?? null, params.data.id]
      );
      if (Number(appRes.rowCount || 0) === 0) {
        await client.query('rollback');
        return reply.code(404).send({ error: 'application_not_found' });
      }
      const application = appRes.rows[0];
      if (parsed.data.status === 'approved') {
        await client.query(
          `update tutor_profiles
           set approval_status = 'approved',
               approval_reviewed_by = $1,
               approval_reviewed_at = now(),
               approval_note = $2,
               qualification_band = coalesce(qualification_band, 'BOTH'),
               qualified_subjects_json = $3::jsonb,
               teaching_preferences_json = $4::jsonb,
               status = 'ACTIVE',
               active = true
           where id = $5`,
          [
            adminId,
            parsed.data.note ?? null,
            JSON.stringify(application.subjects_json ?? []),
            JSON.stringify(application.teaching_preferences_json ?? []),
            application.tutor_id
          ]
        );
      } else {
        await client.query(
          `update tutor_profiles
           set approval_status = $1,
               approval_reviewed_by = $2,
               approval_reviewed_at = now(),
               approval_note = $3
           where id = $4`,
          [parsed.data.status, adminId, parsed.data.note ?? null, application.tutor_id]
        );
      }
      await logAuditSafe(client, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'tutor_application.decision',
        entityType: 'tutor_application',
        entityId: params.data.id,
        meta: safeAuditMeta({ status: parsed.data.status, tutorId: application.tutor_id }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });
      await client.query('commit');
      return reply.send({ application });
    } catch (err: any) {
      await client.query('rollback').catch(() => undefined);
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.patch('/admin/tutor-documents/:id', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = TutorDocumentVerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const res = await pool.query(
      `update tutor_documents
       set verification_status = $1, notes = $2, verified_by = $3, verified_at = now()
       where id = $4
       returning id, tutor_id, document_type, verification_status, verified_at, notes`,
      [parsed.data.status, parsed.data.notes ?? null, req.user!.userId, params.data.id]
    );
    if (Number(res.rowCount || 0) === 0) return reply.code(404).send({ error: 'document_not_found' });
    return reply.send({ document: res.rows[0] });
  });

  app.post('/admin/privacy-requests', async (req, reply) => {
    const parsed = PrivacyRequestCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const adminId = req.user!.userId;
    try {
      const res = await pool.query(
        `insert into privacy_requests
         (request_type, subject_type, subject_id, reason, status, created_by_user_id)
         values ($1, $2, $3, $4, 'OPEN', $5)
         returning *`,
        [
          parsed.data.requestType,
          parsed.data.subjectType,
          parsed.data.subjectId,
          parsed.data.reason ?? null,
          adminId
        ]
      );

      await logAuditSafe(pool, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'privacy_request.create',
        entityType: 'privacy_request',
        entityId: res.rows[0].id,
        meta: safeAuditMeta({
          requestType: parsed.data.requestType,
          subjectType: parsed.data.subjectType,
          subjectId: parsed.data.subjectId
        }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });

      return reply.code(201).send({ request: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/data-classification', async (_req, reply) => {
    return reply.send({ classifications: PII_CLASSIFICATION_MAP });
  });

  app.get('/admin/privacy-requests', async (req, reply) => {
    const parsed = PrivacyRequestQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const { page, pageSize, offset, limit } = parsePagination(req.query as any, { pageSize: 200 });
      const params: any[] = [];
      const filters: string[] = [];
      if (parsed.data.status) {
        params.push(parsed.data.status);
        filters.push(`status = $${params.length}`);
      }
      if (parsed.data.subjectType) {
        params.push(parsed.data.subjectType);
        filters.push(`subject_type = $${params.length}`);
      }
      if (parsed.data.subjectId) {
        params.push(parsed.data.subjectId);
        filters.push(`subject_id = $${params.length}`);
      }

      const where = filters.length ? `where ${filters.join(' and ')}` : '';
      const res = await pool.query(
        `select * from privacy_requests ${where}
         order by created_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*) from privacy_requests ${where}`,
        params
      );

      const total = Number(totalRes.rows[0]?.count || 0);
      return reply.send({
        requests: res.rows,
        items: res.rows,
        total,
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/privacy-requests/:id/export', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const requestId = params.data.id;

    try {
      const res = await pool.query(
        `select * from privacy_requests where id = $1`,
        [requestId]
      );
      if (res.rowCount === 0) return reply.code(404).send({ error: 'privacy_request_not_found' });

      const request = res.rows[0];
      let payload: any = null;
      if (request.subject_type === 'TUTOR') {
        payload = await exportTutorData(pool, request.subject_id);
      } else {
        payload = await exportStudentData(pool, request.subject_id);
      }

      return reply.send({
        request: {
          id: request.id,
          requestType: request.request_type,
          subjectType: request.subject_type,
          subjectId: request.subject_id,
          createdAt: request.created_at
        },
        data: payload
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/privacy-requests/:id/close', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const parsed = PrivacyRequestCloseSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const requestId = params.data.id;
    const adminId = req.user!.userId;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const requestRes = await client.query(`select * from privacy_requests where id = $1`, [requestId]);
      if (requestRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'privacy_request_not_found' });
      }
      const request = requestRes.rows[0];
      if (request.status === 'CLOSED') {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'privacy_request_closed' });
      }

      let outcome = parsed.data.outcome ?? null;

      if (request.request_type === 'CORRECTION') {
        if (request.subject_type === 'TUTOR' && parsed.data.correction?.tutor) {
          const updated = await applyTutorCorrection(client, request.subject_id, parsed.data.correction.tutor);
          if (!updated) {
            await client.query('ROLLBACK');
            return reply.code(404).send({ error: 'tutor_not_found' });
          }
        }

        if (request.subject_type === 'STUDENT' && parsed.data.correction?.student) {
          const updated = await applyStudentCorrection(client, request.subject_id, parsed.data.correction.student);
          if (!updated) {
            await client.query('ROLLBACK');
            return reply.code(404).send({ error: 'student_not_found' });
          }
        }

        outcome = outcome ?? 'CORRECTED';
      }

      if (request.request_type === 'DELETION') {
        if (request.subject_type === 'TUTOR') {
          const okToDelete = await canDeleteTutor(client, request.subject_id);
          if (okToDelete) {
            await client.query(`delete from session_history where session_id in (select id from sessions where tutor_id = $1)`, [request.subject_id]);
            await client.query(`delete from sessions where tutor_id = $1`, [request.subject_id]);
            await client.query(`delete from assignments where tutor_id = $1`, [request.subject_id]);
            await client.query(`delete from invoice_lines where invoice_id in (select id from invoices where tutor_id = $1)`, [request.subject_id]);
            await client.query(`delete from invoices where tutor_id = $1`, [request.subject_id]);
            await client.query(`delete from adjustments where tutor_id = $1`, [request.subject_id]);
            await client.query(`delete from users where tutor_profile_id = $1`, [request.subject_id]);
            await client.query(`delete from tutor_profiles where id = $1`, [request.subject_id]);
            outcome = outcome ?? 'DELETED';
          } else {
            await anonymizeTutor(client, request.subject_id);
            outcome = outcome ?? 'ANONYMIZED';
          }
        } else {
          const okToDelete = await canDeleteStudent(client, request.subject_id);
          if (okToDelete) {
            await client.query(`delete from session_history where session_id in (select id from sessions where student_id = $1)`, [request.subject_id]);
            await client.query(`delete from sessions where student_id = $1`, [request.subject_id]);
            await client.query(`delete from assignments where student_id = $1`, [request.subject_id]);
            await client.query(`delete from students where id = $1`, [request.subject_id]);
            outcome = outcome ?? 'DELETED';
          } else {
            await anonymizeStudent(client, request.subject_id);
            outcome = outcome ?? 'ANONYMIZED';
          }
        }
      }

      if (request.request_type === 'ACCESS' && !outcome) {
        outcome = 'FULFILLED';
      }

      const updatedRes = await client.query(
        `update privacy_requests
         set status = 'CLOSED', outcome = $1, closed_at = now(), closed_by_user_id = $2, close_note = $3
         where id = $4
         returning *`,
        [outcome, adminId, parsed.data.note ?? null, requestId]
      );

      await logAuditSafe(client, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'privacy_request.close',
        entityType: 'privacy_request',
        entityId: requestId,
        meta: safeAuditMeta({
          outcome,
          requestType: request.request_type,
          subjectType: request.subject_type,
          subjectId: request.subject_id
        }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });

      await client.query('COMMIT');
      return reply.send({ request: updatedRes.rows[0] });
    } catch (err: any) {
      await client.query('ROLLBACK');
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/admin/students', async (req, reply) => {
    try {
      const result = await listStudents(pool, req.query as any);
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/admin/students/:id', async (req, reply) => {
    const studentId = (req.params as { id: string }).id;
    const parsed = UpdateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    try {
      const updated = await updateStudent(pool, studentId, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'student_not_found' });
      return reply.send({ student: updated });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/assignments', async (req, reply) => {
    const parsed = AssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    try {
      const result = await createAssignment(pool, parsed.data);
      if ('error' in result) {
        if (result.error === 'tutor_not_found' || result.error === 'student_not_found') {
          return reply.code(404).send({ error: result.error });
        }
        return reply.code(409).send({ error: result.error });
      }
      return reply.code(201).send({ assignment: result.assignment });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/assignments', async (req, reply) => {
    try {
      const result = await listAssignments(pool, req.query as any);
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/admin/assignments/:id', async (req, reply) => {
    const assignmentId = (req.params as { id: string }).id;
    const parsed = UpdateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    try {
      const updated = await updateAssignment(pool, assignmentId, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'assignment_not_found' });
      if ('error' in updated) {
        if (updated.error === 'tutor_not_found' || updated.error === 'student_not_found') {
          return reply.code(404).send({ error: updated.error });
        }
        return reply.code(409).send({ error: updated.error });
      }
      return reply.send({ assignment: updated });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/sessions', async (req, reply) => {
    const parsed = AdminSessionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    try {
      const result = await listSessions(pool, parsed.data);
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/sessions/:id/history', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }

    const sessionId = params.data.id;
    try {
      const history = await getSessionHistory(pool, sessionId);
      return reply.send({ history });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/impersonate/start', async (req, reply) => {
    const parsed = ImpersonateStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const sessionToken = req.cookies?.session;
    if (!sessionToken) return reply.code(401).send({ error: 'unauthorized' });

    try {
      const result = await startImpersonation(
        app,
        pool,
        parsed.data,
        {
          adminId: req.user!.userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
          correlationId: req.id
        },
        sessionToken,
        logAuditSafe
      );

      if (!result) return reply.code(404).send({ error: 'tutor_not_found' });

      reply.setCookie('impersonation', result.token, impersonationCookieOptions());
      return reply.send({
        impersonationId: result.impersonationId,
        tutor: result.tutor
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/impersonate/stop', async (req, reply) => {
    const parsed = ImpersonateStopSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    let impersonationId = parsed.data.impersonationId ?? null;
    if (!impersonationId && req.cookies?.impersonation) {
      try {
        const decoded = await app.jwt.verify<{ impersonationId: string }>(req.cookies.impersonation);
        impersonationId = decoded.impersonationId;
      } catch {
        impersonationId = null;
      }
    }

    try {
      if (impersonationId) {
        await stopImpersonation(
          pool,
          { impersonationId },
          {
            adminId: req.user!.userId,
            ip: req.ip,
            userAgent: req.headers['user-agent'] as string | undefined,
            correlationId: req.id
          },
          logAuditSafe
        );
      }

      reply.clearCookie('impersonation', { path: '/' });
      return reply.send({ ok: true });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      reply.clearCookie('impersonation', { path: '/' });
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/audit', async (req, reply) => {
    const parsed = AuditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const { from, to, actorId, entityType, entityId, page, pageSize } = parsed.data;
      const { where, params } = buildAuditFilters({ from, to, actorId, entityType, entityId });
      const offset = (page - 1) * pageSize;

      const listRes = await pool.query(
        `select a.id, a.action, a.entity_type, a.entity_id, a.meta_json, a.ip, a.user_agent,
                a.correlation_id, a.created_at, a.actor_user_id,
                u.email as actor_email, u.role as actor_role
         from audit_log a
         left join users u on u.id = a.actor_user_id
         ${where}
         order by a.created_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, pageSize, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from audit_log a
         ${where}`,
        params
      );

      const items = listRes.rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        meta: row.meta_json,
        ip: row.ip,
        userAgent: row.user_agent,
        correlationId: row.correlation_id,
        createdAt: row.created_at,
        actor: row.actor_user_id ? {
          id: row.actor_user_id,
          email: row.actor_email,
          role: row.actor_role
        } : null
      }));

      return reply.send({
        items,
        total: Number(totalRes.rows[0].count),
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/audit/export.csv', async (req, reply) => {
    const parsed = AuditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { from, to, actorId, entityType, entityId } = parsed.data;
    const { where, params } = buildAuditFilters({ from, to, actorId, entityType, entityId });

    const csvValue = (value: any) => {
      if (value == null) return '';
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      const escaped = text.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="audit-export.csv"');

    try {
      reply.raw.write('timestamp,action,entity_type,entity_id,actor_id,actor_email,actor_role,ip,user_agent,correlation_id,meta\n');

      const pageSize = 500;
      let page = 1;

      while (true) {
        const offset = (page - 1) * pageSize;
        const rows = await pool.query(
          `select a.action, a.entity_type, a.entity_id, a.meta_json, a.ip, a.user_agent,
                  a.correlation_id, a.created_at, a.actor_user_id,
                  u.email as actor_email, u.role as actor_role
           from audit_log a
           left join users u on u.id = a.actor_user_id
           ${where}
           order by a.created_at desc
           limit $${params.length + 1} offset $${params.length + 2}`,
          [...params, pageSize, offset]
        );

        if (rows.rowCount === 0) break;

        for (const row of rows.rows) {
          const line = [
            csvValue(row.created_at?.toISOString?.() ?? row.created_at),
            csvValue(row.action),
            csvValue(row.entity_type),
            csvValue(row.entity_id),
            csvValue(row.actor_user_id),
            csvValue(row.actor_email),
            csvValue(row.actor_role),
            csvValue(row.ip),
            csvValue(row.user_agent),
            csvValue(row.correlation_id),
            csvValue(row.meta_json)
          ].join(',');
          reply.raw.write(`${line}\n`);
        }

        page += 1;
      }

      reply.raw.end();
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      reply.raw.end();
    }
  });

  app.post('/admin/jobs/audit-export', async (req, reply) => {
    const parsed = AuditLogQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const adminId = req.user!.userId;
    try {
      const job = await enqueueJob(pool, 'audit_export_csv', {
        filters: parsed.data,
        adminId
      });

      await logAuditSafe(pool, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'job.enqueue',
        entityType: 'job',
        entityId: job.id,
        meta: safeAuditMeta({ jobType: job.job_type }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });

      return reply.code(202).send({ jobId: job.id, status: job.status });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/jobs/payroll-generate', async (req, reply) => {
    const parsed = PayrollGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const adminId = req.user!.userId;
    try {
      const job = await enqueueJob(pool, 'payroll_generate', {
        weekStart: parsed.data.weekStart,
        adminId
      });

      await logAuditSafe(pool, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'job.enqueue',
        entityType: 'job',
        entityId: job.id,
        meta: safeAuditMeta({ jobType: job.job_type, weekStart: parsed.data.weekStart }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });

      return reply.code(202).send({ jobId: job.id, status: job.status });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/jobs/payroll-csv', async (req, reply) => {
    const parsed = WeekStartParamSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }

    const adminId = req.user!.userId;
    try {
      const job = await enqueueJob(pool, 'payroll_week_csv', {
        weekStart: parsed.data.weekStart,
        adminId
      });

      await logAuditSafe(pool, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'job.enqueue',
        entityType: 'job',
        entityId: job.id,
        meta: safeAuditMeta({ jobType: job.job_type, weekStart: parsed.data.weekStart }),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id,
      });

      return reply.code(202).send({ jobId: job.id, status: job.status });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/jobs/:id', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }

    try {
      const job = await getJob(pool, params.data.id);
      if (!job) return reply.code(404).send({ error: 'job_not_found' });

      return reply.send({
        job: {
          id: job.id,
          status: job.status,
          jobType: job.job_type,
          createdAt: job.created_at,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          deadLetteredAt: job.dead_lettered_at,
          result: job.result_json ?? null,
          error: job.error_text ?? null
        }
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/jobs/:id/download', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }

    try {
      const job = await getJob(pool, params.data.id);
      if (!job) return reply.code(404).send({ error: 'job_not_found' });
      if (job.status !== 'COMPLETED') return reply.code(409).send({ error: 'job_not_ready' });

      const result = job.result_json || {};
      if (!result.csv) return reply.code(404).send({ error: 'job_result_missing' });

      reply.header('Content-Type', result.contentType || 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${result.filename || 'export.csv'}"`);
      return reply.send(result.csv);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/sessions/bulk-approve', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const parsed = BulkApproveSessionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { sessionIds } = parsed.data;
    const adminId = req.user!.userId;
    const client = await pool.connect();
    try {
      const result = await bulkApprove(
        client,
        { sessionIds },
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      await checkApprovalAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });

      const sessionRows = await pool.query(
        `select s.id, s.student_id, s.date, a.subject
         from sessions s
         join assignments a on a.id = s.assignment_id
         where s.id = any($1::uuid[])`,
        [sessionIds]
      );
      await Promise.all(sessionRows.rows.map((row) => createStudentNotification(pool, {
        studentId: row.student_id,
        type: 'session_approved',
        title: 'Session approved',
        body: `${row.subject || 'Your session'} on ${toDateString(new Date(row.date))} was approved.`,
        link: '/dashboard/',
        entityType: 'session',
        entityId: row.id,
        createdByUserId: adminId,
      })));

      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/admin/students/:id/summary', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    try {
      const [profileRes, baselineRes, goalsRes, attendanceRes, tutorRes] = await Promise.all([
        pool.query(
          `select s.*, u.email
           from students s
           left join users u on u.student_id = s.id
           where s.id = $1`,
          [params.data.id]
        ),
        pool.query(
          `select * from baseline_assessments where student_id = $1 order by completed_at desc`,
          [params.data.id]
        ),
        pool.query(
          `select * from learning_goals where student_id = $1 order by created_at desc`,
          [params.data.id]
        ),
        pool.query(
          `select s.id, s.date, s.start_time, s.status, s.attendance_status, a.subject, t.full_name as tutor_name
           from sessions s
           join assignments a on a.id = s.assignment_id
           join tutor_profiles t on t.id = s.tutor_id
           where s.student_id = $1
           order by s.date desc, s.start_time desc
           limit 50`,
          [params.data.id]
        ),
        pool.query(
          `select a.id as assignment_id, a.subject, a.active, t.id as tutor_id, t.full_name as tutor_name
           from assignments a
           join tutor_profiles t on t.id = a.tutor_id
           where a.student_id = $1
           order by a.start_date desc`,
          [params.data.id]
        )
      ]);
      if (Number(profileRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'student_not_found' });
      return reply.send({
        profile: profileRes.rows[0],
        baselines: baselineRes.rows,
        goals: goalsRes.rows,
        attendance: attendanceRes.rows,
        tutorAssignments: tutorRes.rows,
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/baseline-assessments', async (req, reply) => {
    const query = req.query as { studentId?: string; subject?: string; grade?: string };
    const params: any[] = [];
    const filters: string[] = [];
    if (query.studentId) {
      params.push(query.studentId);
      filters.push(`ba.student_id = $${params.length}`);
    }
    if (query.subject) {
      params.push(query.subject);
      filters.push(`ba.subject = $${params.length}`);
    }
    if (query.grade) {
      params.push(query.grade);
      filters.push(`ba.grade = $${params.length}`);
    }
    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    const res = await pool.query(
      `select ba.*, s.full_name as student_name
       from baseline_assessments ba
       join students s on s.id = ba.student_id
       ${where}
       order by ba.completed_at desc
       limit 200`,
      params
    );
    return reply.send({ baselines: res.rows, items: res.rows });
  });

  app.post('/admin/baseline-assessments', async (req, reply) => {
    const parsed = BaselineAssessmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const data = parsed.data;
    const percentage = Math.round((data.score / data.total) * 10000) / 100;
    const res = await pool.query(
      `insert into baseline_assessments
       (student_id, subject, grade, score, total, percentage, level_band, cognitive_breakdown_json,
        topic_breakdown_json, recommended_next_steps_json, completed_at, created_by_user_id, source_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::timestamptz, $12, $13)
       returning *`,
      [
        data.studentId,
        data.subject,
        data.grade ?? null,
        data.score,
        data.total,
        percentage,
        data.levelBand ?? null,
        JSON.stringify(data.cognitiveBreakdown),
        JSON.stringify(data.topicBreakdown),
        JSON.stringify(data.recommendedNextSteps),
        data.completedAt ?? new Date().toISOString(),
        req.user!.userId,
        data.sourceType
      ]
    );

    await createStudentNotification(pool, {
      studentId: data.studentId,
      type: 'baseline_assessment_created',
      title: 'Baseline assessment ready',
      body: `${data.subject} baseline assessment has been recorded.`,
      link: '/dashboard/',
      entityType: 'baseline_assessment',
      entityId: res.rows[0].id,
      createdByUserId: req.user!.userId,
    });

    return reply.code(201).send({ baseline: res.rows[0] });
  });

  app.get('/admin/learning-goals', async (req, reply) => {
    const query = req.query as { studentId?: string; status?: string };
    const params: any[] = [];
    const filters: string[] = [];
    if (query.studentId) {
      params.push(query.studentId);
      filters.push(`lg.student_id = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`lg.status = $${params.length}`);
    }
    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    const res = await pool.query(
      `select lg.*, s.full_name as student_name
       from learning_goals lg
       join students s on s.id = lg.student_id
       ${where}
       order by lg.created_at desc
       limit 200`,
      params
    );
    return reply.send({ goals: res.rows, items: res.rows });
  });

  app.get('/admin/student-risk', async (req, reply) => {
    const query = req.query as { band?: string };
    const res = await pool.query(
      `select s.id as student_id, s.full_name, s.grade, s.school, s.partner_affiliation,
              latest.risk_score, latest.momentum_score, latest.reasons_json, latest.score_date,
              ba.percentage as baseline_percentage,
              count(la.id) filter (where la.status = 'assigned')::int as open_assignments,
              count(sess.id) filter (where sess.status = 'DRAFT' and sess.date < current_date)::int as missing_reports
       from students s
       left join users u on u.student_id = s.id
       left join lateral (
         select risk_score, momentum_score, reasons_json, score_date
         from student_score_snapshots sss
         where sss.user_id = u.id
         order by score_date desc
         limit 1
       ) latest on true
       left join lateral (
         select percentage
         from baseline_assessments
         where student_id = s.id
         order by completed_at desc
         limit 1
       ) ba on true
       left join learning_assignments la on la.student_id = s.id
       left join sessions sess on sess.student_id = s.id
       group by s.id, s.full_name, s.grade, s.school, s.partner_affiliation,
                latest.risk_score, latest.momentum_score, latest.reasons_json, latest.score_date, ba.percentage
       order by latest.risk_score desc nulls last, s.full_name asc`
    );
    const learners = res.rows
      .map((row) => ({
        ...row,
        supportStatus: supportBandFromRiskScore(row.risk_score == null ? null : Number(row.risk_score)),
      }))
      .filter((row) => !query.band || row.supportStatus.band === query.band);
    return reply.send({ learners, items: learners });
  });

  app.post('/admin/learning-goals', async (req, reply) => {
    const parsed = LearningGoalSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const data = parsed.data;
    const res = await pool.query(
      `insert into learning_goals
       (student_id, title, description, category, subject, target_value, current_value, due_date,
        status, created_by_user_id, visible_to_student, visible_to_tutor)
       values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12)
       returning *`,
      [
        data.studentId,
        data.title,
        data.description ?? null,
        data.category,
        data.subject ?? null,
        data.targetValue ?? null,
        data.currentValue ?? null,
        data.dueDate ?? null,
        data.status,
        req.user!.userId,
        data.visibleToStudent,
        data.visibleToTutor
      ]
    );

    if (data.visibleToStudent) {
      await createStudentNotification(pool, {
        studentId: data.studentId,
        type: 'learning_goal_created',
        title: 'New goal added',
        body: `${data.title} has been added to your study plan.`,
        link: '/dashboard/',
        entityType: 'learning_goal',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });
    }

    return reply.code(201).send({ goal: res.rows[0] });
  });

  app.patch('/admin/learning-goals/:id', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = UpdateLearningGoalSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const currentRes = await pool.query(`select * from learning_goals where id = $1`, [params.data.id]);
    if (Number(currentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'goal_not_found' });
    const current = currentRes.rows[0];
    const data = parsed.data;
    const res = await pool.query(
      `update learning_goals
       set title = $1, description = $2, category = $3, subject = $4, target_value = $5,
           current_value = $6, due_date = $7::date, status = $8, visible_to_student = $9,
           visible_to_tutor = $10, updated_at = now()
       where id = $11
       returning *`,
      [
        data.title ?? current.title,
        data.description ?? current.description,
        data.category ?? current.category,
        data.subject ?? current.subject,
        data.targetValue ?? current.target_value,
        data.currentValue ?? current.current_value,
        data.dueDate ?? current.due_date,
        data.status ?? current.status,
        data.visibleToStudent ?? current.visible_to_student,
        data.visibleToTutor ?? current.visible_to_tutor,
        params.data.id
      ]
    );

    if (res.rows[0].visible_to_student) {
      await createStudentNotification(pool, {
        studentId: current.student_id,
        type: data.status === 'completed' ? 'learning_goal_completed' : 'learning_goal_updated',
        title: data.status === 'completed' ? 'Goal completed' : 'Goal updated',
        body: data.status === 'completed'
          ? `${res.rows[0].title} is now marked as completed.`
          : `${res.rows[0].title} has been updated.`,
        link: '/dashboard/',
        entityType: 'learning_goal',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });
    }

    return reply.send({ goal: res.rows[0] });
  });

  app.get('/admin/learning-assignments', async (req, reply) => {
    const query = req.query as { subject?: string; sort?: string };
    const params: any[] = [];
    const filters: string[] = [];
    if (query.subject) {
      params.push(query.subject);
      filters.push(`la.subject = $${params.length}`);
    }
    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    const order = query.sort === 'dueDate'
      ? `coalesce(la.due_date, la.created_at::date) asc, la.created_at desc`
      : `la.created_at desc`;
    const res = await pool.query(
      `select la.*, t.full_name as tutor_name, st.full_name as student_name,
              count(sub.id)::int as submission_count
       from learning_assignments la
       join tutor_profiles t on t.id = la.tutor_id
       join students st on st.id = la.student_id
       left join assignment_submissions sub on sub.assignment_id = la.id
       ${where}
       group by la.id, t.full_name, st.full_name
       order by ${order}`,
      params
    );
    return reply.send({ assignments: res.rows, items: res.rows });
  });

  app.post('/admin/learning-assignments', async (req, reply) => {
    const parsed = AdminLearningAssignmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const data = parsed.data;
    const activeLink = await pool.query(
      `select id from assignments
       where tutor_id = $1 and student_id = $2 and subject = $3 and active = true
       order by start_date desc
       limit 1`,
      [data.tutorId, data.studentId, data.subject]
    );
    const res = await pool.query(
      `insert into learning_assignments
       (tutor_id, student_id, teaching_assignment_id, subject, title, description, instructions,
        due_date, status, published_at, created_by_user_id, created_by_admin_id)
       values ($1, $2, $3, $4, $5, $6, $6, $7::date, $8, case when $8 = 'published' then now() else null end, $9, $9)
       returning *`,
      [
        data.tutorId,
        data.studentId,
        activeLink.rows[0]?.id ?? null,
        data.subject,
        data.title,
        data.description ?? null,
        data.dueDate ?? null,
        data.status,
        req.user!.userId,
      ]
    );

    if (res.rows[0].status !== 'draft') {
      await createStudentNotification(pool, {
        studentId: data.studentId,
        type: 'learning_assignment_published',
        title: 'New assignment published',
        body: `${data.title} has been published for you.`,
        link: '/dashboard/assignments/',
        entityType: 'learning_assignment',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });
    }

    return reply.code(201).send({ assignment: res.rows[0] });
  });

  app.patch('/admin/learning-assignments/:id', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = AdminLearningAssignmentPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const currentRes = await pool.query(`select * from learning_assignments where id = $1`, [params.data.id]);
    if (Number(currentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'assignment_not_found' });
    const current = currentRes.rows[0];
    const data = parsed.data;
    const nextStatus = data.status ?? current.status;
    const res = await pool.query(
      `update learning_assignments
       set subject = $1,
           title = $2,
           description = $3,
           instructions = $3,
           due_date = $4::date,
           status = $5,
           published_at = case
             when $5 = 'published' and published_at is null then now()
             when $5 = 'draft' then null
             else published_at
           end,
           updated_at = now()
       where id = $6
       returning *`,
      [
        data.subject ?? current.subject,
        data.title ?? current.title,
        data.description ?? current.description ?? current.instructions,
        data.dueDate ?? current.due_date,
        nextStatus,
        params.data.id,
      ]
    );

    if (nextStatus !== 'draft') {
      await createStudentNotification(pool, {
        studentId: current.student_id,
        type: nextStatus === 'published' ? 'learning_assignment_published' : 'learning_assignment_updated',
        title: nextStatus === 'published' ? 'Assignment published' : 'Assignment updated',
        body: nextStatus === 'published'
          ? `${res.rows[0].title} has been published for you.`
          : `${res.rows[0].title} has been updated.`,
        link: '/dashboard/assignments/',
        entityType: 'learning_assignment',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });
    }

    return reply.send({ assignment: res.rows[0] });
  });

  app.get('/admin/assignment-submissions', async (_req, reply) => {
    const res = await pool.query(
      `select sub.*, la.title as assignment_title, la.subject, st.full_name as student_name
       from assignment_submissions sub
       join learning_assignments la on la.id = sub.assignment_id
       join students st on st.id = sub.student_id
       order by sub.submitted_at desc
       limit 300`
    );
    return reply.send({ submissions: res.rows, items: res.rows });
  });

  app.get('/admin/results/analytics', async (_req, reply) => {
    const [summaryRes, distRes, trendRes, topicRes, studentRes] = await Promise.all([
      pool.query(`select round(avg(percentage)::numeric, 2) as class_average, count(*)::int as results_count from baseline_assessments`),
      pool.query(
        `select width_bucket(percentage, 0, 100, 5) as bucket, count(*)::int as count
         from baseline_assessments
         group by bucket
         order by bucket`
      ),
      pool.query(
        `select date_trunc('month', completed_at)::date as period, round(avg(percentage)::numeric, 2) as average
         from baseline_assessments
         group by period
         order by period`
      ),
      pool.query(
        `select ba.topic, round(avg(ba.score)::numeric, 2) as average_score, count(*)::int as support
         from baseline_assessments b
         cross join lateral jsonb_each(b.topic_breakdown_json) as raw(topic, payload)
         cross join lateral (
           select raw.topic, coalesce((raw.payload ->> 'score')::numeric, (raw.payload ->> 'percentage')::numeric, null) as score
         ) ba
         where ba.score is not null
         group by ba.topic
         order by average_score asc
         limit 12`
      ),
      pool.query(
        `select s.id as student_id, s.full_name, round(avg(b.percentage)::numeric, 2) as average_score, count(b.id)::int as results_count
         from students s
         left join baseline_assessments b on b.student_id = s.id
         group by s.id, s.full_name
         order by average_score asc nulls last, s.full_name asc
         limit 100`
      ),
    ]);
    return reply.send({
      summary: summaryRes.rows[0] ?? { class_average: null, results_count: 0 },
      scoreDistribution: distRes.rows,
      trend: trendRes.rows,
      weakAreas: topicRes.rows,
      students: studentRes.rows,
      classificationReport: [],
      confusionMatrix: [],
    });
  });

  app.get('/admin/tutor-performance', async (_req, reply) => {
    const res = await pool.query(
      `select t.id as tutor_id, t.full_name,
              count(distinct a.student_id)::int as assigned_learners,
              count(distinct a.subject)::int as active_subjects,
              count(s.id) filter (where s.status = 'APPROVED')::int as sessions_completed,
              count(s.id) filter (where s.status in ('SUBMITTED','APPROVED','REJECTED'))::int as reports_submitted,
              count(s.id)::int as sessions_total,
              count(s.id) filter (where s.status = 'DRAFT' and s.date < current_date)::int as missing_reports,
              coalesce(sum(vl.hours) filter (where vl.status = 'verified'), 0)::numeric as verified_volunteer_hours
       from tutor_profiles t
       left join assignments a on a.tutor_id = t.id and a.active = true
       left join sessions s on s.tutor_id = t.id
       left join volunteer_logs vl on vl.tutor_id = t.id
       group by t.id, t.full_name
       order by t.full_name asc`
    );
    return reply.send({
      tutors: res.rows.map((row) => {
        const total = Number(row.sessions_total || 0);
        const submitted = Number(row.reports_submitted || 0);
        return {
          ...row,
          report_submission_rate: total > 0 ? Math.round((submitted / total) * 100) : 0,
          payout_ready_sessions: Number(row.sessions_completed || 0)
        };
      })
    });
  });

  app.get('/admin/volunteer/events', async (_req, reply) => {
    const res = await pool.query(`select * from volunteer_events order by event_date desc nulls last, created_at desc`);
    return reply.send({ events: res.rows });
  });

  app.post('/admin/volunteer/events', async (req, reply) => {
    const parsed = VolunteerEventSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const data = parsed.data;
    const res = await pool.query(
      `insert into volunteer_events
       (title, description, event_date, start_time, end_time, location, mode, status, created_by_user_id)
       values ($1, $2, $3::date, $4::time, $5::time, $6, $7, $8, $9)
       returning *`,
      [data.title, data.description ?? null, data.eventDate ?? null, data.startTime ?? null, data.endTime ?? null, data.location ?? null, data.mode, data.status, req.user!.userId]
    );
    return reply.code(201).send({ event: res.rows[0] });
  });

  app.get('/admin/volunteer/logs', async (_req, reply) => {
    const res = await pool.query(
      `select vl.*, t.full_name as tutor_name, ve.title as event_title
       from volunteer_logs vl
       join tutor_profiles t on t.id = vl.tutor_id
       left join volunteer_events ve on ve.id = vl.event_id
       order by vl.created_at desc`
    );
    return reply.send({ logs: res.rows });
  });

  app.get('/admin/volunteer/impact', async (_req, reply) => {
    const res = await pool.query(
      `select date_trunc('month', coalesce(vl.volunteered_on, vl.created_at::date))::date as month,
              count(*) filter (where vl.status = 'verified')::int as verified_logs,
              coalesce(sum(vl.hours) filter (where vl.status = 'verified'), 0)::numeric as verified_hours,
              count(distinct vl.tutor_id) filter (where vl.status = 'verified')::int as active_tutors
       from volunteer_logs vl
       group by 1
       order by 1 desc`
    );
    return reply.send({ months: res.rows });
  });

  app.get('/admin/volunteer/impact.csv', async (_req, reply) => {
    const res = await pool.query(
      `select date_trunc('month', coalesce(vl.volunteered_on, vl.created_at::date))::date as month,
              count(*) filter (where vl.status = 'verified')::int as verified_logs,
              coalesce(sum(vl.hours) filter (where vl.status = 'verified'), 0)::numeric as verified_hours,
              count(distinct vl.tutor_id) filter (where vl.status = 'verified')::int as active_tutors
       from volunteer_logs vl
       group by 1
       order by 1 desc`
    );
    const lines = ['month,verified_logs,verified_hours,active_tutors'];
    for (const row of res.rows) {
      lines.push([
        toDateString(row.month),
        row.verified_logs,
        row.verified_hours,
        row.active_tutors
      ].join(','));
    }
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="volunteer-impact.csv"');
    return reply.send(`${lines.join('\n')}\n`);
  });

  app.post('/admin/volunteer/logs/:id/verify', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = VolunteerLogVerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const res = await pool.query(
      `update volunteer_logs
       set status = $1, admin_note = $2, verified_by = $3, verified_at = now(), updated_at = now()
       where id = $4 and status in ('submitted','signed_up','rejected')
       returning *`,
      [parsed.data.status, parsed.data.adminNote ?? null, req.user!.userId, params.data.id]
    );
    if (Number(res.rowCount || 0) === 0) return reply.code(404).send({ error: 'volunteer_log_not_found' });
    return reply.send({ log: res.rows[0] });
  });

  app.post('/admin/sessions/bulk-reject', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const parsed = BulkRejectSessionsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { sessionIds, reason } = parsed.data;
    const adminId = req.user!.userId;
    const client = await pool.connect();
    try {
      const result = await bulkReject(
        client,
        { sessionIds, reason },
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      await checkApprovalAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });

      const sessionRows = await pool.query(
        `select s.id, s.student_id, s.date, a.subject
         from sessions s
         join assignments a on a.id = s.assignment_id
         where s.id = any($1::uuid[])`,
        [sessionIds]
      );
      await Promise.all(sessionRows.rows.map((row) => createStudentNotification(pool, {
        studentId: row.student_id,
        type: 'session_rejected',
        title: 'Session rejected',
        body: `${row.subject || 'Your session'} on ${toDateString(new Date(row.date))} was rejected.`,
        link: '/dashboard/',
        entityType: 'session',
        entityId: row.id,
        createdByUserId: adminId,
      })));

      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.post('/admin/sessions/:id/approve', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const sessionId = params.data.id;
    const adminId = req.user!.userId;
    try {
      const result = await approveSession(
        pool,
        sessionId,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        if (result.error === 'session_not_found') return reply.code(404).send({ error: result.error });
        return reply.code(409).send({ error: result.error });
      }
      await checkApprovalAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });

      const sessionRows = await pool.query(
        `select s.id, s.student_id, s.date, a.subject
         from sessions s
         join assignments a on a.id = s.assignment_id
         where s.id = $1`,
        [sessionId]
      );
      if (sessionRows.rowCount ?? 0 > 0) {
        const row = sessionRows.rows[0];
        await createStudentNotification(pool, {
          studentId: row.student_id,
          type: 'session_approved',
          title: 'Session approved',
          body: `${row.subject || 'Your session'} on ${toDateString(new Date(row.date))} was approved.`,
          link: '/dashboard/',
          entityType: 'session',
          entityId: row.id,
          createdByUserId: adminId,
        });
      }

      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/sessions/:id/reject', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const sessionId = params.data.id;
    const adminId = req.user!.userId;
    const parsed = RejectSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    try {
      const result = await rejectSession(
        pool,
        sessionId,
        parsed.data,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        if (result.error === 'session_not_found') return reply.code(404).send({ error: result.error });
        return reply.code(409).send({ error: result.error });
      }
      await checkApprovalAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });

      const sessionRows = await pool.query(
        `select s.id, s.student_id, s.date, a.subject
         from sessions s
         join assignments a on a.id = s.assignment_id
         where s.id = $1`,
        [sessionId]
      );
      if (sessionRows.rowCount ?? 0 > 0) {
        const row = sessionRows.rows[0];
        await createStudentNotification(pool, {
          studentId: row.student_id,
          type: 'session_rejected',
          title: 'Session rejected',
          body: `${row.subject || 'Your session'} on ${toDateString(new Date(row.date))} was rejected.`,
          link: '/dashboard/',
          entityType: 'session',
          entityId: row.id,
          createdByUserId: adminId,
        });
      }

      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/payroll/generate-week', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const parsed = PayrollGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const adminId = req.user!.userId;
    const client = await pool.connect();
    try {
      const result = await generatePayrollWeek(
        client,
        parsed.data,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        return reply.code(409).send({ error: result.error });
      }
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.post('/admin/pay-periods/:weekStart/lock', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = WeekStartParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }
    const weekStart = params.data.weekStart;
    const adminId = req.user!.userId;

    const client = await pool.connect();
    try {
      const result = await lockPayPeriod(
        client,
        weekStart,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        if (result.error === 'internal_error') {
          return reply.code(500).send({ error: result.error });
        }
        return reply.code(409).send({ error: result.error });
      }
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.post('/admin/pay-periods/:weekStart/adjustments', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = WeekStartParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }
    const weekStart = params.data.weekStart;
    const parsed = AdjustmentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const adminId = req.user!.userId;

    const client = await pool.connect();
    try {
      const result = await createAdjustment(
        client,
        weekStart,
        parsed.data,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        if (result.error === 'tutor_not_found') return reply.code(404).send({ error: result.error });
        if (result.error === 'related_session_invalid') return reply.code(400).send({ error: result.error });
        if (result.error === 'internal_error') return reply.code(500).send({ error: result.error });
      }
      await checkPayrollAdjustmentAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/admin/pay-periods/:weekStart/adjustments', async (req, reply) => {
    const params = WeekStartParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }
    const weekStart = params.data.weekStart;
    try {
      const result = await listAdjustments(pool, weekStart);
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.delete('/admin/adjustments/:id', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const parsed = DeleteAdjustmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const adjustmentId = params.data.id;
    const adminId = req.user!.userId;
    try {
      const result = await deleteAdjustment(
        pool,
        adjustmentId,
        parsed.data,
        adminId,
        { adminId, ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined, correlationId: req.id },
        logAuditSafe
      );
      if ('error' in result) {
        if (result.error === 'adjustment_not_found') return reply.code(404).send({ error: result.error });
        return reply.code(409).send({ error: result.error });
      }
      await checkPayrollAdjustmentAlerts(adminId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        correlationId: req.id
      });
      return reply.send(result);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/payroll/week/:weekStart.csv', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = WeekStartParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }
    const weekStart = params.data.weekStart;

    try {
      const res = await pool.query(
        `select i.invoice_number, i.period_start, i.period_end, i.total_amount,
                t.full_name as tutor_name,
                l.session_id, l.adjustment_id, l.line_type, l.description, l.minutes, l.rate, l.amount
         from invoices i
         join tutor_profiles t on t.id = i.tutor_id
         join invoice_lines l on l.invoice_id = i.id
         where i.period_start = $1::date
         order by t.full_name asc, i.invoice_number asc`,
        [weekStart]
      );

      const header = 'invoice_number,period_start,period_end,tutor_name,session_id,adjustment_id,line_type,description,minutes,rate,amount,total_amount';
      const lines = res.rows.map((row) => {
        const safe = (value: any) => String(value ?? '').replaceAll('"', '""');
        return [
          row.invoice_number,
          row.period_start.toISOString().slice(0, 10),
          row.period_end.toISOString().slice(0, 10),
          safe(row.tutor_name),
          row.session_id ?? '',
          row.adjustment_id ?? '',
          row.line_type,
          safe(row.description),
          row.minutes,
          row.rate,
          row.amount,
          row.total_amount
        ].join(',');
      });

      const csv = [header, ...lines].join('\n');
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="payroll-${weekStart}.csv"`);
      return reply.send(csv);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/admin/integrity/pay-period/:weekStart', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const params = WeekStartParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_week_start' });
    }
    const weekStart = params.data.weekStart;

    try {
      const range = getPayPeriodRange(weekStart);

      const [
        payPeriodRes,
        overlappingRes,
        assignmentRes,
        missingInvoiceLinesRes,
        invoiceMismatchRes,
        pendingRes,
        duplicateRes
      ] = await Promise.all([
        pool.query(`select id, status from pay_periods where period_start_date = $1::date`, [weekStart]),
        pool.query(
          `select s1.id as session_id, s1.tutor_id, s1.student_id, s1.date, s1.start_time, s1.end_time,
                  s2.id as overlap_id
           from sessions s1
           join sessions s2
             on s1.tutor_id = s2.tutor_id
            and s1.id < s2.id
            and s1.date = s2.date
            and not (s1.end_time <= s2.start_time or s1.start_time >= s2.end_time)
           where s1.date between $1::date and $2::date`,
          [weekStart, range.end]
        ),
        pool.query(
          `select s.id, s.tutor_id, s.student_id, s.date, s.start_time, s.end_time,
                  a.start_date, a.end_date, a.allowed_days_json, a.allowed_time_ranges_json
           from sessions s
           join assignments a on a.id = s.assignment_id
           where s.date between $1::date and $2::date`,
          [weekStart, range.end]
        ),
        pool.query(
          `select s.id, s.tutor_id, s.date
           from sessions s
           left join invoice_lines l
             on l.session_id = s.id and l.line_type = 'SESSION'
           where s.status = 'APPROVED'
             and s.date between $1::date and $2::date
             and l.id is null`,
          [weekStart, range.end]
        ),
        pool.query(
          `select i.id, i.invoice_number, i.total_amount,
                  coalesce(sum(l.amount), 0) as line_total
           from invoices i
           left join invoice_lines l on l.invoice_id = i.id
           where i.period_start = $1::date
           group by i.id
           having i.total_amount <> coalesce(sum(l.amount), 0)`,
          [weekStart]
        ),
        pool.query(
          `select s.tutor_id, t.full_name as tutor_name, count(*) as pending
           from sessions s
           join tutor_profiles t on t.id = s.tutor_id
           where s.status = 'SUBMITTED'
             and s.date between $1::date and $2::date
           group by s.tutor_id, t.full_name
           order by t.full_name asc`,
          [weekStart, range.end]
        ),
        pool.query(
          `select tutor_id, student_id, date, start_time, end_time, count(*) as count
           from sessions
           where date between $1::date and $2::date
           group by tutor_id, student_id, date, start_time, end_time
           having count(*) > 1
           order by date asc`,
          [weekStart, range.end]
        )
      ]);

      const outsideAssignment = assignmentRes.rows.filter((row) => {
        const date = toDateString(row.date);
        const allowedDays = normalizeJson(row.allowed_days_json) ?? [];
        const allowedTimeRanges = normalizeJson(row.allowed_time_ranges_json) ?? [];
        return !isWithinAssignmentWindow(date, row.start_time, row.end_time, {
          startDate: toDateString(row.start_date),
          endDate: row.end_date ? toDateString(row.end_date) : null,
          allowedDays,
          allowedTimeRanges
        });
      });

      return reply.send({
        payPeriod: payPeriodRes.rows[0] ?? { status: 'OPEN' },
        overlaps: overlappingRes.rows,
        outsideAssignmentWindow: outsideAssignment,
        missingInvoiceLines: missingInvoiceLinesRes.rows,
        invoiceTotalMismatches: invoiceMismatchRes.rows,
        pendingSubmissions: pendingRes.rows,
        duplicateSessions: duplicateRes.rows
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/admin/invoices/:id/mark-paid', async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const invoiceId = params.data.id;
    try {
      const res = await pool.query(
        `update invoices set status = 'PAID' where id = $1 returning id, status`,
        [invoiceId]
      );
      if (res.rowCount === 0) return reply.code(404).send({ error: 'invoice_not_found' });
      return reply.send({ invoice: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
}
