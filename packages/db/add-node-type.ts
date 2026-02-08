import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function addNodeType() {
  console.log("Adding node_type column to thinking_nodes...");

  // Check if column exists by trying to select it
  const { data, error: checkError } = await supabase
    .from("thinking_nodes")
    .select("node_type")
    .limit(1);

  if (!checkError) {
    console.log("Column node_type already exists!");
    return;
  }

  if (checkError.message.includes("node_type")) {
    console.log("Column does not exist, need to add it via Supabase SQL editor.");
    console.log("\nRun this SQL in Supabase Dashboard -> SQL Editor:\n");
    console.log(`
ALTER TABLE thinking_nodes
ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'thinking'
CHECK (node_type IN ('thinking', 'compaction', 'fork_branch', 'human_annotation'));

CREATE INDEX IF NOT EXISTS thinking_nodes_node_type_idx
ON thinking_nodes(node_type);
    `);
  } else {
    console.error("Unexpected error:", checkError);
  }
}

addNodeType().catch(console.error);
