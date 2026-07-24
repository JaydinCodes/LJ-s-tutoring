import { parseStudentCareersApiResponse } from '../../types/studentApiContracts';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import careersDataset from '../../data/odie-careers/careers.v1.json';
import coursesDataset from '../../data/odie-careers/courses.v1.json';

export interface CareerSummary {
  id: string;
  title: string;
  description?: string;
  category?: string;
  salaryRange?: {
    low: number;
    median: number;
    high: number;
  };
  demandLabel?: string;
  growthLabel?: string;
  pathCategories?: string[];
  forecast?: {
    summary?: string;
    confidence?: string;
    forecastScore?: number;
  };
}

export interface StudentCareerProfile {
  interests: string[];
  preferredSubjects: string[];
  targetCareers: string[];
  apsTarget: number | null;
  savedCareers: string[];
}

export interface CareerOverview {
  careers?: CareerSummary[];
  institutions?: Array<{ id: string; name: string; city: string; institutionTypes?: string[] }>;
  supportedSubjects?: string[];
  profile?: StudentCareerProfile;
}

const emptyProfile: StudentCareerProfile = {
  interests: [],
  preferredSubjects: [],
  targetCareers: [],
  apsTarget: null,
  savedCareers: [],
};

type CareerProfileRow = {
  interests_json?: unknown;
  preferred_subjects_json?: unknown;
  target_careers_json?: unknown;
  aps_target?: number | null;
  saved_careers_json?: unknown;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapProfileRow(row: CareerProfileRow | null): StudentCareerProfile {
  if (!row) {
    return emptyProfile;
  }
  return {
    interests: toStringArray(row.interests_json),
    preferredSubjects: toStringArray(row.preferred_subjects_json),
    targetCareers: toStringArray(row.target_careers_json),
    apsTarget: typeof row.aps_target === 'number' ? row.aps_target : null,
    savedCareers: toStringArray(row.saved_careers_json),
  };
}

async function currentStudentId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  // Capture the non-null client so narrowing survives the awaits below.
  const client = supabase;
  const { data: auth } = await client.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) {
    return null;
  }
  const profileResult = await client.from('profiles').select('id').eq('auth_user_id', authUserId).maybeSingle();
  const profileId = (profileResult.data as { id?: string } | null)?.id;
  if (!profileId) {
    return null;
  }
  const studentResult = await client.from('students').select('id').eq('profile_id', profileId).maybeSingle();
  return (studentResult.data as { id?: string } | null)?.id ?? null;
}

// Single-stack migration: careers reference data (careers, institutions, subjects)
// is static and bundled; only the learner's own career profile is read from
// Supabase (student_career_profiles, RLS-scoped to the signed-in student),
// replacing the legacy /odie-careers/overview API.
export async function loadCareersOverview() {
  const base = {
    careers: careersDataset.careers,
    institutions: coursesDataset.institutions,
    supportedSubjects: coursesDataset.supportedSubjects,
    profile: emptyProfile,
  };
  if (!isSupabaseConfigured || !supabase) {
    return parseStudentCareersApiResponse(base, base);
  }
  // RLS scopes this to the current student's single row (unique student_id).
  const profileResult = await supabase.from('student_career_profiles').select('*').maybeSingle();
  const profile = mapProfileRow((profileResult.data as CareerProfileRow | null) ?? null);
  return parseStudentCareersApiResponse({ ...base, profile }, base);
}

// Student-owned upsert into student_career_profiles (allowed direct Supabase write
// per ADR-0001: a low-risk self-service record, RLS-scoped to the student),
// replacing the legacy PUT /odie-careers/profile API.
export async function saveCareerProfile(profile: StudentCareerProfile): Promise<{ profile: StudentCareerProfile }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('supabase_not_configured');
  }
  // Capture the non-null client so narrowing survives the await below.
  const client = supabase;
  const studentId = await currentStudentId();
  if (!studentId) {
    throw new Error('student_profile_missing');
  }
  const payload = {
    student_id: studentId,
    interests_json: profile.interests,
    preferred_subjects_json: profile.preferredSubjects,
    target_careers_json: profile.targetCareers,
    aps_target: profile.apsTarget,
    saved_careers_json: profile.savedCareers,
    updated_at: new Date().toISOString(),
  };
  // supabase-js insert/upsert typing resolves the values arg to never[] for some
  // tables; the codebase's established pattern (see classManagementMutations) is to
  // cast the query builder to the upsert shape.
  const result = await (client.from('student_career_profiles') as unknown as {
    upsert: (row: typeof payload, options: { onConflict: string }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  })
    .upsert(payload, { onConflict: 'student_id' })
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  return { profile: mapProfileRow(result.data as CareerProfileRow) };
}
