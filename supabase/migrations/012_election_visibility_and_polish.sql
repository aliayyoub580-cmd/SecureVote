-- Add visibility column to elections table
ALTER TABLE elections ADD COLUMN IF NOT EXISTS visibility TEXT CHECK (visibility IN ('public', 'private')) DEFAULT 'public';

-- Add comment for documentation
COMMENT ON COLUMN elections.visibility IS 'Whether the election is publicly discoverable or requires a direct link/invitation.';

-- Ensure RLS allows selecting public elections (this might already be handled by status checks, but let's be explicit if needed)
-- Note: Existing policies usually filter by status. We might need to adjust them if "private" elections shouldn't show up in public lists even if approved.
