/**
 * Test script to verify all API connections for Opus Nx
 * Run with: npx tsx scripts/test-connections.ts
 */

import "dotenv/config";

const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

function log(status: "ok" | "error" | "warn" | "info", message: string) {
  const prefix = {
    ok: `${COLORS.green}✓${COLORS.reset}`,
    error: `${COLORS.red}✗${COLORS.reset}`,
    warn: `${COLORS.yellow}⚠${COLORS.reset}`,
    info: `${COLORS.cyan}ℹ${COLORS.reset}`,
  };
  console.log(`${prefix[status]} ${message}`);
}

async function testAnthropic(): Promise<boolean> {
  console.log("\n--- Testing Anthropic API ---");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log("error", "ANTHROPIC_API_KEY not set");
    return false;
  }

  if (!apiKey.startsWith("sk-ant-")) {
    log("warn", "ANTHROPIC_API_KEY doesn't start with 'sk-ant-' - may be invalid");
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say 'ok'" }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      log("ok", `Anthropic API connected - Model: ${data.model}`);
      return true;
    } else {
      const error = await response.json();
      log("error", `Anthropic API error: ${error.error?.message || response.status}`);
      return false;
    }
  } catch (err) {
    log("error", `Anthropic API connection failed: ${err}`);
    return false;
  }
}

async function testSupabase(): Promise<boolean> {
  console.log("\n--- Testing Supabase ---");

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) {
    log("error", "SUPABASE_URL not set");
    return false;
  }

  if (!serviceKey) {
    log("error", "SUPABASE_SERVICE_ROLE_KEY not set");
    return false;
  }

  // Check key format
  if (!serviceKey.startsWith("eyJ")) {
    log("warn", "SUPABASE_SERVICE_ROLE_KEY doesn't look like a JWT (should start with 'eyJ')");
    log("info", "Go to Supabase Dashboard → Project Settings → API → Copy 'service_role' key");
  }

  if (anonKey && !anonKey.startsWith("eyJ")) {
    log("warn", "SUPABASE_ANON_KEY doesn't look like a JWT (should start with 'eyJ')");
  }

  try {
    // Test connection to Supabase REST API
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (response.ok || response.status === 200) {
      log("ok", `Supabase connected - URL: ${url}`);
      return true;
    } else if (response.status === 401) {
      log("error", "Supabase authentication failed - check your service_role key");
      return false;
    } else {
      log("warn", `Supabase responded with status ${response.status}`);
      return false;
    }
  } catch (err) {
    log("error", `Supabase connection failed: ${err}`);
    return false;
  }
}

async function testVoyage(): Promise<boolean> {
  console.log("\n--- Testing Voyage AI ---");

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    log("warn", "VOYAGE_API_KEY not set (optional - needed for semantic memory retrieval)");
    return true;
  }

  if (!apiKey.startsWith("pa-")) {
    log("warn", "VOYAGE_API_KEY doesn't start with 'pa-' - may be invalid");
  }

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: "test",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const dims = data.data?.[0]?.embedding?.length;
      log("ok", `Voyage AI connected - Model: voyage-3, Dimensions: ${dims}`);
      return true;
    } else {
      const error = await response.json();
      log("warn", `Voyage AI error (optional provider): ${error.detail || response.status}`);
      return true;
    }
  } catch (err) {
    log("warn", `Voyage AI connection failed (optional provider): ${err}`);
    return true;
  }
}

async function testTavily(): Promise<boolean> {
  console.log("\n--- Testing Tavily Search ---");

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    log("warn", "TAVILY_API_KEY not set (optional - needed for Research Agent)");
    return true; // Optional
  }

  if (!apiKey.startsWith("tvly-")) {
    log("warn", "TAVILY_API_KEY doesn't start with 'tvly-' - may be invalid");
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: "test",
        max_results: 1,
      }),
    });

    if (response.ok) {
      log("ok", "Tavily Search connected");
      return true;
    } else {
      const error = await response.json();
      log("warn", `Tavily error (optional provider): ${error.detail || response.status}`);
      return true;
    }
  } catch (err) {
    log("warn", `Tavily connection failed (optional provider): ${err}`);
    return true;
  }
}

async function main() {
  console.log("🧪 Testing Opus Nx API Connections...\n");

  const results = {
    anthropic: await testAnthropic(),
    supabase: await testSupabase(),
    voyage: await testVoyage(),
    tavily: await testTavily(),
  };

  console.log("\n--- Summary ---");
  const allPassed = Object.values(results).every(Boolean);

  if (allPassed) {
    log("ok", "All connections successful! Ready to proceed with Day 2.");
  } else {
    log("warn", "Some connections failed. Please fix before continuing.");
    console.log("\nFailed services:");
    for (const [service, passed] of Object.entries(results)) {
      if (!passed) {
        log("error", `  - ${service}`);
      }
    }
  }
}

main().catch(console.error);
