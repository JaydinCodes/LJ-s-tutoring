import { z } from 'zod';

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeString = z.string().regex(/^\d{2}:\d{2}$/);
const SessionStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const TutorStatusSchema = z.enum(['INVITED', 'VERIFIED', 'ACTIVE']);
const QualificationBandSchema = z.enum(['GRADES_6_9', 'GRADES_10_12', 'BOTH']);

export const EmailSchema = z.string().email().transform((s) => s.trim().toLowerCase());

export const PasswordSchema = z
  .string()
  .min(10, 'password_too_short')
  .max(200, 'password_too_long');

export const RegisterAdminSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  bootstrapToken: z.string().min(1),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});

export const TestLoginSchema = z.object({
  role: z.enum(['ADMIN', 'TUTOR', 'STUDENT']),
  email: EmailSchema,
});

export const StudyActivityTypeSchema = z.enum([
  'practice_completed',
  'session_attended',
  'goal_completed',
  'focus_session'
]);

export const StudyActivityEventSchema = z.object({
  type: StudyActivityTypeSchema,
  occurredAt: z.string().datetime().optional(),
  dedupeKey: z.string().trim().min(8).max(120).optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

export const WeeklyReportGenerateSchema = z.object({
  studentId: z.string().uuid().optional(),
  weekStart: DateString.optional()
});

export const WeeklyReportsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20)
});

export const MagicLinkRequestSchema = z.object({
  email: EmailSchema,
});

export const AdminLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});

export const AdminOtpSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'otp_must_be_6_digits'),
});

export const CreateTutorSchema = z.object({
  email: EmailSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  defaultHourlyRate: z.number().min(0).max(10000),
  active: z.boolean().optional().default(true),
  qualificationBand: QualificationBandSchema.optional().default('BOTH'),
  qualifiedSubjects: z.array(z.string().trim().min(1).max(120)).min(1).optional().default(['Mathematics']),
  status: TutorStatusSchema.optional().default('INVITED'),
});

export const UpdateTutorSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  defaultHourlyRate: z.number().min(0).max(10000).optional(),
  active: z.boolean().optional(),
  qualificationBand: QualificationBandSchema.optional(),
  qualifiedSubjects: z.array(z.string().trim().min(1).max(120)).min(1).optional(),
  status: TutorStatusSchema.optional(),
});

export const CreateStudentSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(200).optional(),
  grade: z.string().trim().max(20).optional(),
  school: z.string().trim().max(160).optional(),
  subjects: z.array(z.string().trim().min(1).max(120)).max(30).optional().default([]),
  guardianName: z.string().trim().max(120).optional(),
  guardianRelationship: z.string().trim().max(80).optional(),
  guardianPhone: z.string().trim().max(40).optional(),
  guardianEmail: z.string().trim().email().max(254).optional(),
  guardianAddress: z.string().trim().max(500).optional(),
  partnerAffiliation: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  active: z.boolean().optional().default(true),
}).superRefine((value, ctx) => {
  if (value.password && !value.email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: 'Email is required when setting a password',
    });
  }
});

export const UpdateStudentSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  grade: z.string().trim().max(20).optional().nullable(),
  school: z.string().trim().max(160).optional().nullable(),
  subjects: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  guardianName: z.string().trim().max(120).optional().nullable(),
  guardianRelationship: z.string().trim().max(80).optional().nullable(),
  guardianPhone: z.string().trim().max(40).optional().nullable(),
  guardianEmail: z.string().trim().email().max(254).optional().nullable(),
  guardianAddress: z.string().trim().max(500).optional().nullable(),
  partnerAffiliation: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

export const BaselineAssessmentSchema = z.object({
  studentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  grade: z.string().trim().max(20).optional().nullable(),
  score: z.number().min(0).max(100000),
  total: z.number().positive().max(100000),
  levelBand: z.string().trim().max(80).optional().nullable(),
  cognitiveBreakdown: z.record(z.unknown()).optional().default({}),
  topicBreakdown: z.record(z.unknown()).optional().default({}),
  recommendedNextSteps: z.array(z.string().trim().min(1).max(240)).max(20).optional().default([]),
  completedAt: z.string().datetime().optional(),
  sourceType: z.enum(['manual', 'uploaded', 'generated', 'diagnostic']).optional().default('manual'),
});

export const LearningGoalSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(['academic', 'attendance', 'assignment', 'career', 'intervention']).optional().default('academic'),
  subject: z.string().trim().max(120).optional().nullable(),
  targetValue: z.number().max(100000).optional().nullable(),
  currentValue: z.number().max(100000).optional().nullable(),
  dueDate: DateString.optional().nullable(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional().default('active'),
  visibleToStudent: z.boolean().optional().default(true),
  visibleToTutor: z.boolean().optional().default(true),
});

export const UpdateLearningGoalSchema = LearningGoalSchema.omit({ studentId: true }).partial();

export const StudentExamEventSchema = z.object({
  studentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  examDate: DateString,
});

export const StudentExamEventsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
});

export const AssignmentSchema = z.object({
  tutorId: z.string().uuid(),
  studentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  startDate: DateString,
  endDate: DateString.optional().nullable(),
  rateOverride: z.number().min(0).max(10000).optional().nullable(),
  allowedDays: z.array(z.number().int().min(0).max(6)).default([]),
  allowedTimeRanges: z.array(
    z.object({
      start: TimeString,
      end: TimeString,
    })
  ).default([]),
  active: z.boolean().optional().default(true),
});

export const UpdateAssignmentSchema = z.object({
  subject: z.string().trim().min(1).max(120).optional(),
  startDate: DateString.optional(),
  endDate: DateString.optional().nullable(),
  rateOverride: z.number().min(0).max(10000).optional().nullable(),
  allowedDays: z.array(z.number().int().min(0).max(6)).optional(),
  allowedTimeRanges: z.array(
    z.object({
      start: TimeString,
      end: TimeString,
    })
  ).optional(),
  active: z.boolean().optional(),
});

export const CreateSessionSchema = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  date: DateString,
  startTime: TimeString,
  endTime: TimeString,
  mode: z.string().trim().min(1).max(40),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

export const UpdateSessionSchema = z.object({
  date: DateString.optional(),
  startTime: TimeString.optional(),
  endTime: TimeString.optional(),
  mode: z.string().trim().min(1).max(40).optional(),
  location: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const RejectSessionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const PayrollGenerateSchema = z.object({
  weekStart: DateString,
});

export const AdjustmentCreateSchema = z.object({
  tutorId: z.string().uuid(),
  type: z.enum(['BONUS', 'CORRECTION', 'PENALTY']),
  amount: z.number().positive().max(1000000),
  reason: z.string().trim().min(1).max(2000),
  relatedSessionId: z.string().uuid().optional().nullable(),
});

export const DateRangeQuerySchema = z.object({
  from: DateString.optional(),
  to: DateString.optional(),
});

export const AdminSessionsQuerySchema = DateRangeQuerySchema.extend({
  status: SessionStatusSchema.optional(),
  tutorId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['createdAt', 'date', 'tutor', 'student']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
});

export const TutorSessionsQuerySchema = DateRangeQuerySchema.extend({
  status: SessionStatusSchema.optional(),
});

const StringArraySchema = z.array(z.string().trim().min(1).max(120)).max(40);

export const TutorApplicationSchema = z.object({
  personalDetails: z.record(z.unknown()).optional().default({}),
  subjects: StringArraySchema.default([]),
  grades: StringArraySchema.default([]),
  teachingPreferences: StringArraySchema.default([]),
  experience: z.string().trim().max(5000).optional().nullable(),
  availabilityNotes: z.string().trim().max(3000).optional().nullable(),
});

export const TutorApplicationDecisionSchema = z.object({
  status: z.enum(['under_review', 'approved', 'rejected', 'changes_requested']),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const TutorDocumentUploadSchema = z.object({
  documentType: z.enum(['identity', 'cv', 'qualification', 'additional']),
  originalFilename: z.string().trim().min(1).max(180),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  contentBase64: z.string().min(1),
});

export const TutorDocumentVerifySchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const TutorAvailabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: TimeString,
    endTime: TimeString,
    mode: z.string().trim().min(1).max(40).default('online'),
    notes: z.string().trim().max(500).optional().nullable(),
  })).max(42),
});

export const SessionReportSchema = z.object({
  attendanceStatus: z.enum(['present', 'absent', 'late', 'excused']).optional().nullable(),
  topicsCovered: z.string().trim().max(3000).optional().nullable(),
  learnerStruggles: z.string().trim().max(3000).optional().nullable(),
  homeworkAssigned: z.string().trim().max(3000).optional().nullable(),
  tutorPrivateNotes: z.string().trim().max(3000).optional().nullable(),
  studentSummary: z.string().trim().max(3000).optional().nullable(),
});

export const LearningAssignmentCreateSchema = z.object({
  assignmentId: z.string().uuid().optional().nullable(),
  studentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  instructions: z.string().trim().max(5000).optional().nullable(),
  dueDate: DateString.optional().nullable(),
});

export const VolunteerEventSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(3000).optional().nullable(),
  eventDate: DateString.optional().nullable(),
  startTime: TimeString.optional().nullable(),
  endTime: TimeString.optional().nullable(),
  location: z.string().trim().max(180).optional().nullable(),
  mode: z.string().trim().min(1).max(40).default('in-person'),
  status: z.enum(['planned', 'cancelled', 'completed']).optional().default('planned'),
});

export const VolunteerLogSchema = z.object({
  eventId: z.string().uuid().optional().nullable(),
  hours: z.number().min(0).max(1000).optional().nullable(),
  volunteeredOn: DateString.optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
  evidenceDocumentId: z.string().uuid().optional().nullable(),
});

export const VolunteerLogVerifySchema = z.object({
  status: z.enum(['verified', 'rejected']),
  adminNote: z.string().trim().max(2000).optional().nullable(),
});

export const WeekStartParamSchema = z.object({
  weekStart: DateString,
});

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DeleteAdjustmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const BulkApproveSessionsSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1),
});

export const BulkRejectSessionsSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1),
  reason: z.string().trim().max(500).optional(),
});

export const PrivacyRequestCreateSchema = z.object({
  requestType: z.enum(['ACCESS', 'CORRECTION', 'DELETION']),
  subjectType: z.enum(['TUTOR', 'STUDENT']),
  subjectId: z.string().uuid(),
  reason: z.string().trim().max(2000).optional(),
});

export const PrivacyRequestQuerySchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  subjectType: z.enum(['TUTOR', 'STUDENT']).optional(),
  subjectId: z.string().uuid().optional(),
});

export const PrivacyRequestCloseSchema = z.object({
  outcome: z.enum(['FULFILLED', 'REJECTED', 'ANONYMIZED', 'DELETED', 'CORRECTED']).optional(),
  note: z.string().trim().max(2000).optional(),
  correction: z.object({
    tutor: UpdateTutorSchema.optional(),
    student: UpdateStudentSchema.optional(),
  }).optional(),
});

export const ImpersonateStartSchema = z.object({
  tutorId: z.string().uuid(),
});

export const ImpersonateStopSchema = z.object({
  impersonationId: z.string().uuid().optional(),
});

export const AuditLogQuerySchema = DateRangeQuerySchema.extend({
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
});

export const ArcadePlayerCreateSchema = z.object({
  nickname: z.string().trim().min(1).max(32).optional(),
});

export const ArcadeSessionStartSchema = z.object({
  playerId: z.string().uuid(),
  gameId: z.string().trim().min(1).max(80),
  gameTitle: z.string().trim().min(1).max(120).optional(),
  clientFingerprint: z.string().trim().min(1).max(200).optional(),
  source: z.string().trim().min(1).max(40).optional(),
});

export const ArcadeSessionEndSchema = z.object({
  sessionId: z.string().uuid(),
  endedAt: z.string().datetime().optional(),
  reason: z.string().trim().max(120).optional(),
});

export const ArcadeEventSchema = z.object({
  type: z.string().trim().min(1).max(80),
  payload: z.record(z.any()).optional().default({}),
  frame: z.number().int().min(0).max(1000000).optional().nullable(),
});

export const ArcadeScoreSchema = z.object({
  playerId: z.string().uuid(),
  gameId: z.string().trim().min(1).max(80),
  gameTitle: z.string().trim().min(1).max(120).optional(),
  sessionId: z.string().uuid(),
  sessionToken: z.string().trim().min(10).max(2048),
  score: z.number().int().min(0).max(100000000),
  telemetry: z.object({
    runSeed: z.string().trim().min(1).max(120).optional(),
    durationMs: z.number().int().min(0).max(10000000).optional(),
    eventCount: z.number().int().min(0).max(1000000).optional(),
    events: z.array(ArcadeEventSchema).optional(),
  }).optional(),
});

export const ArcadeLeaderboardParamSchema = z.object({
  game: z.string().trim().min(1).max(80),
});

export const ArcadeLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const ArcadeBaseEventObjectSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum([
    'ad_impression',
    'ad_click',
    'reward_completed',
    'game_session_start',
    'game_session_end',
    'score_submitted',
    'score_validated',
  ]),
  occurredAt: z.string().datetime(),
  sessionId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  anonId: z.string().trim().min(1).max(120).optional().nullable(),
  source: z.string().trim().max(40).optional().nullable(),
  dedupeKey: z.string().trim().min(8).max(200),
  payload: z.record(z.any()).optional().default({}),
});

export const ArcadeGameplayEventSchema = ArcadeBaseEventObjectSchema.superRefine((val, ctx) => {
  if (!val.userId && !val.anonId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'user_id_or_anon_id_required' });
  }
});

export const ArcadeAdEventSchema = ArcadeBaseEventObjectSchema.extend({
  placement: z.string().trim().min(1).max(80).optional().nullable(),
  provider: z.string().trim().min(1).max(80).optional().nullable(),
  creativeId: z.string().trim().min(1).max(120).optional().nullable(),
  variantId: z.string().trim().min(1).max(120).optional().nullable(),
}).superRefine((val, ctx) => {
  if (!val.userId && !val.anonId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'user_id_or_anon_id_required' });
  }
});

export const ArcadeMatchEventSchema = z.object({
  gameId: z.string().trim().min(1).max(80),
  runSeed: z.string().trim().min(1).max(160),
  events: z.array(ArcadeEventSchema).min(1).max(5000),
});

export const ArcadeValidationSchema = z.object({
  gameId: z.string().trim().min(1).max(80),
  runSeed: z.string().trim().min(1).max(160),
  score: z.number().int().min(0).max(100000000),
  events: z.array(ArcadeEventSchema).min(1).max(5000),
});

export const OdieCareersSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

export const OdieCareerIdParamSchema = z.object({
  careerId: z.string().trim().min(1).max(120),
});

export const StudentSubjectResultSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  percentage: z.coerce.number().min(0).max(100),
});

export const OdieCareersEligibilityRequestSchema = z.object({
  subjects: z.array(StudentSubjectResultSchema).min(1).max(20),
});


export const OdieReadinessPlanQuerySchema = z.object({
  careerId: z.string().trim().min(1).max(120),
  studentId: z.string().trim().min(1).max(120).optional(),
});

export const OdieReadinessMilestoneParamSchema = z.object({
  id: z.string().trim().min(1).max(160),
});

export const OdieReadinessEvidenceSchema = z.object({
  type: z.enum([
    'project_link',
    'github_repo',
    'live_demo',
    'certificate',
    'challenge_completion',
    'assessment_score',
    'uploaded_file',
    'portfolio_case_study',
    'linkedin_post',
    'recommendation',
    'reflection',
  ]),
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(400),
  description: z.string().trim().max(500).optional(),
});

export const OdieReadinessCompleteBodySchema = z.object({
  careerId: z.string().trim().min(1).max(120),
  evidence: z.array(OdieReadinessEvidenceSchema).max(20).optional().default([]),
  reflection: z.string().trim().max(1000).optional(),
});
