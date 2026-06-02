import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../lib/rbac.js';
import {
  OdieCareerIdParamSchema,
  OdieCareersEligibilityRequestSchema,
  OdieCareersSearchQuerySchema,
  OdieReadinessCompleteBodySchema,
  OdieReadinessMilestoneParamSchema,
  OdieReadinessPlanQuerySchema,
  StudentCareerProfileUpdateSchema,
} from '../lib/schemas.js';
import { pool } from '../db/pool.js';
import {
  completeReadinessMilestone,
  evaluateStudentProfile,
  getCareerDetail,
  getOdieCareersOverview,
  getReadinessPlanForCareer,
  searchCareerSummaries,
} from '../domains/odie-careers/service.js';

function setPrivateNoStore(reply: any) {
  reply.header('Cache-Control', 'private, no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
}

function odieCareersPreHandler(app: FastifyInstance) {
  const devBypassEnabled = process.env.ODIE_CAREERS_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
  if (devBypassEnabled) {
    return [];
  }
  return [app.authenticate, requireAuth, requireRole('STUDENT')];
}

function resolveReadinessStudentId(req: any, fallbackStudentId?: string) {
  if (req.user?.studentId) {
    return req.user.studentId as string;
  }
  if (process.env.ODIE_CAREERS_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return fallbackStudentId || 'dev-student';
  }
  return null;
}

const emptyCareerProfile = {
  interests: [],
  preferredSubjects: [],
  targetCareers: [],
  apsTarget: null,
  savedCareers: [],
};

function normalizeCareerProfile(row: any) {
  if (!row) return emptyCareerProfile;
  return {
    interests: Array.isArray(row.interests_json) ? row.interests_json : [],
    preferredSubjects: Array.isArray(row.preferred_subjects_json) ? row.preferred_subjects_json : [],
    targetCareers: Array.isArray(row.target_careers_json) ? row.target_careers_json : [],
    apsTarget: row.aps_target == null ? null : Number(row.aps_target),
    savedCareers: Array.isArray(row.saved_careers_json) ? row.saved_careers_json : [],
  };
}

async function getStudentCareerProfile(studentId: string) {
  // The profile is optional by design; first-time learners get an empty cockpit state.
  const res = await pool.query(
    `select interests_json, preferred_subjects_json, target_careers_json, aps_target, saved_careers_json
     from student_career_profiles
     where student_id = $1
     limit 1`,
    [studentId]
  );
  return normalizeCareerProfile(res.rows[0]);
}

export async function odieCareersRoutes(app: FastifyInstance) {
  app.get('/odie-careers/overview', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const studentId = resolveReadinessStudentId(req);
    const profile = studentId ? await getStudentCareerProfile(studentId) : emptyCareerProfile;
    return reply.send({ ...getOdieCareersOverview(), profile });
  });

  app.get('/odie-careers/profile', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const studentId = resolveReadinessStudentId(req);
    if (!studentId) return reply.code(401).send({ error: 'unauthorized' });
    return reply.send({ profile: await getStudentCareerProfile(studentId) });
  });

  app.put('/odie-careers/profile', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const studentId = resolveReadinessStudentId(req);
    if (!studentId) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = StudentCareerProfileUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const profile = parsed.data;
    await pool.query(
      `insert into student_career_profiles (
          student_id, interests_json, preferred_subjects_json, target_careers_json, aps_target, saved_careers_json
       )
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6::jsonb)
       on conflict (student_id) do update set
          interests_json = excluded.interests_json,
          preferred_subjects_json = excluded.preferred_subjects_json,
          target_careers_json = excluded.target_careers_json,
          aps_target = excluded.aps_target,
          saved_careers_json = excluded.saved_careers_json,
          updated_at = now()`,
      [
        studentId,
        JSON.stringify(profile.interests),
        JSON.stringify(profile.preferredSubjects),
        JSON.stringify(profile.targetCareers),
        profile.apsTarget,
        JSON.stringify(profile.savedCareers),
      ]
    );
    return reply.send({ profile });
  });

  app.get('/odie-careers/careers', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = OdieCareersSearchQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    return reply.send({ items: searchCareerSummaries(parsed.data.q) });
  });

  app.get('/odie-careers/careers/:careerId', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = OdieCareerIdParamSchema.safeParse(req.params ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const detail = getCareerDetail(parsed.data.careerId);
    if (!detail) {
      return reply.code(404).send({ error: 'career_not_found' });
    }
    return reply.send(detail);
  });

  app.get('/odie-careers/readiness/plan', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = OdieReadinessPlanQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const studentId = resolveReadinessStudentId(req, parsed.data.studentId);
    if (!studentId) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const plan = getReadinessPlanForCareer(studentId, parsed.data.careerId);
    if (!plan) {
      return reply.code(404).send({ error: 'career_not_found' });
    }
    return reply.send(plan);
  });

  app.post('/odie-careers/readiness/milestone/:id/complete', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const params = OdieReadinessMilestoneParamSchema.safeParse(req.params ?? {});
    const body = OdieReadinessCompleteBodySchema.safeParse(req.body ?? {});
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        details: {
          params: params.success ? null : params.error.flatten(),
          body: body.success ? null : body.error.flatten(),
        },
      });
    }

    const studentId = resolveReadinessStudentId(req);
    if (!studentId) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const completion = completeReadinessMilestone(studentId, body.data.careerId, params.data.id, body.data);
    if ('error' in completion) {
      if (completion.error === 'career_not_found' || completion.error === 'milestone_not_found') {
        return reply.code(404).send(completion);
      }
      if (completion.error === 'evidence_required') {
        return reply.code(422).send(completion);
      }
      return reply.code(400).send(completion);
    }

    return reply.send(completion);
  });

  app.post('/odie-careers/eligibility/evaluate', {
    preHandler: odieCareersPreHandler(app),
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = OdieCareersEligibilityRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    return reply.send(evaluateStudentProfile(parsed.data));
  });
}
