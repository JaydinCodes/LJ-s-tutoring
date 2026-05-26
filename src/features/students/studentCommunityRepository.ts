import { apiGet, apiPost } from '../../lib/api/client';

export interface StudyRoom {
  id: string;
  subject: string;
  grade?: string | null;
  member_count?: number;
  memberCount?: number;
  is_member?: boolean;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  content: string;
  nickname?: string | null;
  student_name?: string | null;
  authorName?: string | null;
  created_at?: string;
  createdAt?: string;
}

export interface CommunityChallenge {
  id: string;
  title: string;
  subject?: string | null;
  grade?: string | null;
  week_start?: string;
  weekStart?: string;
  week_end?: string;
  weekEnd?: string;
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
  nickname?: string | null;
  created_at?: string;
}

async function optionalCommunityGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('501') ||
      message.includes('Failed to fetch')
    ) {
      return fallback;
    }
    throw error;
  }
}

export async function loadCommunityOverview() {
  const [rooms, challenges, questions] = await Promise.all([
    optionalCommunityGet<{ items: StudyRoom[]; total?: number }>('/community/rooms', { items: [] }),
    optionalCommunityGet<{ items: CommunityChallenge[]; total?: number }>('/community/challenges', { items: [] }),
    optionalCommunityGet<{ items: CommunityQuestion[]; total?: number }>('/community/questions', { items: [] }),
  ]);

  return {
    rooms: rooms.items || [],
    challenges: challenges.items || [],
    questions: questions.items || [],
  };
}

export function createStudyRoom(input: { subject: string; grade?: string }) {
  return apiPost<{ room: StudyRoom }>('/community/rooms', input);
}

export function joinStudyRoom(roomId: string) {
  return apiPost<{ ok: true }>(`/community/rooms/${encodeURIComponent(roomId)}/join`);
}

export async function loadRoomMessages(roomId: string) {
  return optionalCommunityGet<{ items: RoomMessage[]; total?: number }>(`/community/rooms/${encodeURIComponent(roomId)}/messages`, { items: [] });
}

export function postRoomMessage(roomId: string, content: string) {
  return apiPost<{ message: RoomMessage }>(`/community/rooms/${encodeURIComponent(roomId)}/messages`, { content });
}
