type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
};

export interface StudentNotificationInput {
  studentId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

export async function createStudentNotification(db: Queryable, input: StudentNotificationInput) {
  const res = await db.query(
    `insert into student_notifications
     (student_id, type, title, body, link, entity_type, entity_id, metadata_json, created_by_user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     returning id, student_id, type, title, body, link, entity_type, entity_id, metadata_json, is_read, read_at, created_at`,
    [
      input.studentId,
      input.type,
      input.title,
      input.body,
      input.link ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.createdByUserId ?? null,
    ]
  );
  return res.rows[0];
}

export async function listStudentNotifications(db: Queryable, studentId: string, limit = 12) {
  const res = await db.query(
    `select id, student_id, type, title, body, link, entity_type, entity_id,
            metadata_json, is_read, read_at, created_at
     from student_notifications
     where student_id = $1
     order by created_at desc
     limit $2`,
    [studentId, limit]
  );
  return res.rows;
}

export async function countUnreadStudentNotifications(db: Queryable, studentId: string) {
  const res = await db.query(
    `select count(*)::int as unread_count
     from student_notifications
     where student_id = $1 and is_read = false`,
    [studentId]
  );
  return Number(res.rows[0]?.unread_count || 0);
}

export async function markStudentNotificationRead(db: Queryable, studentId: string, notificationId: string) {
  const res = await db.query(
    `update student_notifications
     set is_read = true,
         read_at = coalesce(read_at, now()),
         updated_at = now()
     where id = $1 and student_id = $2
     returning id`,
    [notificationId, studentId]
  );
  return res.rowCount ?? 0;
}

export async function markAllStudentNotificationsRead(db: Queryable, studentId: string) {
  const res = await db.query(
    `update student_notifications
     set is_read = true,
         read_at = coalesce(read_at, now()),
         updated_at = now()
     where student_id = $1 and is_read = false`,
    [studentId]
  );
  return res.rowCount ?? 0;
}
