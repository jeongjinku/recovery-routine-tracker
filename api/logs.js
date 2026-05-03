const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getCoupleId() {
  return process.env.COUPLE_ID || "our-family";
}

module.exports = async function handler(request, response) {
  response.setHeader("Content-Type", "application/json");

  try {
    const supabase = getSupabaseClient();
    const coupleId = getCoupleId();

    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("logs")
        .select("log_date,data")
        .eq("couple_id", coupleId)
        .order("log_date", { ascending: false });

      if (error) throw error;
      return response.status(200).json({ logs: data });
    }

    if (request.method === "POST") {
      const log =
        typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body;
      if (!log?.date) {
        return response.status(400).json({ error: "Missing log date" });
      }

      const { error } = await supabase.from("logs").upsert(
        {
          couple_id: coupleId,
          log_date: log.date,
          data: log,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "couple_id,log_date" }
      );

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (request.method === "DELETE") {
      const date = request.query.date;
      if (!date) {
        return response.status(400).json({ error: "Missing log date" });
      }

      const { error } = await supabase
        .from("logs")
        .delete()
        .eq("couple_id", coupleId)
        .eq("log_date", date);

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
};
