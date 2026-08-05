-- Candidate profile: designation + manifesto (long-form); optional fields for ballot UX

alter table public.election_candidates add column if not exists designation text;
alter table public.election_candidates add column if not exists manifesto text;
