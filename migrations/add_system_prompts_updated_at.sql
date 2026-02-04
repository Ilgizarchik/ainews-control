-- Add updated_at column to system_prompts table
-- This tracks when prompts are last modified

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_prompts' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE system_prompts 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Update existing rows to have current timestamp
        UPDATE system_prompts SET updated_at = NOW();
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_prompts_updated_at 
ON system_prompts(updated_at DESC);

-- Optional: Create trigger to auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_system_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_prompts_updated_at ON system_prompts;

CREATE TRIGGER trigger_update_system_prompts_updated_at
BEFORE UPDATE ON system_prompts
FOR EACH ROW
EXECUTE FUNCTION update_system_prompts_updated_at();
