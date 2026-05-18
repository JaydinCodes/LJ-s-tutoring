import type { DbClient } from '../shared/types.js';
import type { CreateStudentInput, UpdateStudentInput, StudentSummary } from './contracts.js';
import { parsePagination } from '../../../lib/pagination.js';
import { hashPassword, normalizeEmail } from '../../../lib/security.js';

export async function createStudent(client: DbClient, input: CreateStudentInput) {
  const studentRes = await client.query(
    `insert into students
     (full_name, grade, school, subjects_json, guardian_name, guardian_relationship, guardian_phone, guardian_email, guardian_address, partner_affiliation, notes, is_active)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
     returning id, full_name, grade, school, subjects_json, guardian_name, guardian_relationship, guardian_phone, guardian_email, guardian_address, partner_affiliation, notes, is_active as active`,
    [
      input.fullName,
      input.grade ?? null,
      input.school ?? null,
      JSON.stringify(input.subjects ?? []),
      input.guardianName ?? null,
      input.guardianRelationship ?? null,
      input.guardianPhone ?? null,
      input.guardianEmail ?? null,
      input.guardianAddress ?? null,
      input.partnerAffiliation ?? null,
      input.notes ?? null,
      input.active
    ]
  );

  const student = studentRes.rows[0];
  let email: string | null = null;

  if (input.email) {
    email = normalizeEmail(input.email);
    const passwordHash = input.password ? await hashPassword(input.password) : null;
    await client.query(
      `insert into users (email, role, student_id, password_hash, is_active)
       values ($1, 'STUDENT', $2, $3, $4)`,
      [email, student.id, passwordHash, input.active]
    );
  }

  return { ...student, email };
}

export async function listStudents(
  client: DbClient,
  query: { page?: unknown; pageSize?: unknown; q?: string } = {}
): Promise<{ students: StudentSummary[]; items: StudentSummary[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const q = query.q?.trim();
  const filters: string[] = [];
  const params: any[] = [];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(s.full_name ilike $${params.length} or s.guardian_name ilike $${params.length} or u.email ilike $${params.length})`);
  }

  const where = filters.length ? `where ${filters.join(' and ')}` : '';

  const res = await client.query(
    `select s.id, s.full_name, u.email, s.grade, s.school, s.subjects_json,
            s.guardian_name, s.guardian_relationship, s.guardian_phone, s.guardian_email,
            s.guardian_address, s.partner_affiliation, s.notes, s.is_active as active
     from students s
     left join users u on u.student_id = s.id
     ${where}
     order by s.full_name asc
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalRes = await client.query(
    `select count(*)
     from students s
     left join users u on u.student_id = s.id
     ${where}`,
    params
  );

  const total = Number(totalRes.rows[0]?.count || 0);
  return { students: res.rows, items: res.rows, total, page, pageSize };
}

export async function updateStudent(client: DbClient, studentId: string, input: UpdateStudentInput) {
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
     returning id, full_name, null::text as email, grade, school, subjects_json,
               guardian_name, guardian_relationship, guardian_phone, guardian_email,
               guardian_address, partner_affiliation, notes, is_active as active`,
    [
      input.fullName ?? current.full_name,
      input.grade ?? current.grade,
      input.school ?? current.school,
      input.subjects ? JSON.stringify(input.subjects) : current.subjects_json,
      input.guardianName ?? current.guardian_name,
      input.guardianRelationship ?? current.guardian_relationship,
      input.guardianPhone ?? current.guardian_phone,
      input.guardianEmail ?? current.guardian_email,
      input.guardianAddress ?? current.guardian_address,
      input.partnerAffiliation ?? current.partner_affiliation,
      input.notes ?? current.notes,
      input.active ?? current.is_active,
      studentId
    ]
  );

  return res.rows[0];
}
