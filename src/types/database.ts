// Low-level database shapes are generated from the linked Supabase schema.
// Keep domain/view DTOs in lms.ts and repository-local files; never recreate
// database tables or RPC signatures by hand here.
export type { Database, Json } from '../../supabase/types/public.generated';
