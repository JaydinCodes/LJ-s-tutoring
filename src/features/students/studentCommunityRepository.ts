import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { CommunityChallengeRow, CommunityQuestionRow, CommunityRoomMessageRow, CommunityRoomRow } from '../../types/lms';

export interface StudyRoom {
  id: string;
  subject: string;
  grade?: string | null;
  member_count?: number;
  is_member?: boolean;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  content: string;
  student_name?: string | null;
  created_at?: string;
}

export interface CommunityChallenge {
  id: string;
  title: string;
  subject?: string | null;
  grade?: string | null;
  week_start?: string;
  week_end?: string;
  xp_reward?: number;
  has_submitted?: boolean;
}

export interface CommunityQuestion {
  id: string;
  subject?: string | null;
  topic?: string | null;
  title: string;
  body?: string | null;
  status?: string;
  answer_count?: number;
  verified_answer_id?: string | null;
  created_at?: string;
}

function mapRoom(row: CommunityRoomRow): StudyRoom {
  return {
    id: row.id,
    subject: row.subject,
    grade: row.grade,
    member_count: row.member_count,
    is_member: row.is_member,
  };
}

function mapMessage(row: CommunityRoomMessageRow): RoomMessage {
  return {
    id: row.id,
    room_id: row.room_id,
    content: row.content,
    student_name: row.sender_name,
    created_at: row.created_at,
  };
}

function mapChallenge(row: CommunityChallengeRow): CommunityChallenge {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade,
    week_start: row.week_start,
    week_end: row.week_end,
    xp_reward: row.xp_reward,
    has_submitted: row.has_submitted,
  };
}

function mapQuestion(row: CommunityQuestionRow): CommunityQuestion {
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    title: row.title,
    body: row.body,
    status: row.status,
    answer_count: row.answer_count,
    verified_answer_id: row.verified_answer_id,
    created_at: row.created_at,
  };
}

export async function loadCommunityOverview() {
  const client = requireSupabase();
  const [rooms, challenges, questions] = await Promise.all([
    callRpc(client, 'get_community_rooms', {}),
    callRpc(client, 'get_community_challenges', {}),
    callRpc(client, 'get_community_questions', {}),
  ]);

  return {
    rooms: (rooms || []).map(mapRoom),
    challenges: (challenges || []).map(mapChallenge),
    questions: (questions || []).map(mapQuestion),
  };
}

export async function createStudyRoom(input: { subject: string; grade?: string }) {
  const client = requireSupabase();
  const room = await callRpc(client, 'create_study_room', { p_subject: input.subject, p_grade: input.grade ?? null });
  return { room: mapRoom({ ...room, member_count: 1, is_member: true }) };
}

export async function joinStudyRoom(roomId: string) {
  const client = requireSupabase();
  await callRpc(client, 'join_study_room', { p_room_id: roomId });
  return { ok: true as const };
}

export async function loadRoomMessages(roomId: string) {
  const client = requireSupabase();
  const rows = await callRpc(client, 'get_room_messages', { p_room_id: roomId });
  return { items: (rows || []).map(mapMessage) };
}

export async function postRoomMessage(roomId: string, content: string) {
  const client = requireSupabase();
  const message = await callRpc(client, 'post_room_message', { p_room_id: roomId, p_content: content });
  return { message: mapMessage(message) };
}
