import type { z } from 'zod';
import { CreateStudentSchema, UpdateStudentSchema } from '../../../lib/schemas.js';

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

export type StudentSummary = {
  id: string;
  full_name: string;
  email: string | null;
  grade: string | null;
  school?: string | null;
  subjects_json?: unknown;
  guardian_name: string | null;
  guardian_relationship?: string | null;
  guardian_phone: string | null;
  guardian_email?: string | null;
  guardian_address?: string | null;
  partner_affiliation?: string | null;
  notes: string | null;
  active: boolean;
};
