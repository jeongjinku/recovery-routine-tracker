import { NextRequest, NextResponse } from "next/server";
import { getCoupleId, getSupabaseAdmin } from "@/lib/supabase";
import type { LogEntry } from "@/lib/types";

function getLocalDataApiBase() {
  if (process.env.NODE_ENV !== "development") return "";
  return process.env.LOCAL_DATA_API_BASE_URL || "";
}

async function proxyToRemoteApi(path: string, init?: RequestInit) {
  const baseUrl = getLocalDataApiBase();
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function GET() {
  try {
    const proxied = await proxyToRemoteApi("/api/logs");
    if (proxied) return proxied;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("logs")
      .select("log_date,data")
      .eq("couple_id", getCoupleId())
      .order("log_date", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ logs: data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const log = (await request.json()) as LogEntry;
    if (!log?.date) {
      return NextResponse.json({ error: "Missing log date" }, { status: 400 });
    }

    const proxied = await proxyToRemoteApi("/api/logs", {
      method: "POST",
      body: JSON.stringify(log),
    });
    if (proxied) return proxied;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("logs").upsert(
      {
        couple_id: getCoupleId(),
        log_date: log.date,
        data: log,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "couple_id,log_date" }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "Missing log date" }, { status: 400 });
    }

    const proxied = await proxyToRemoteApi(`/api/logs?date=${encodeURIComponent(date)}`, {
      method: "DELETE",
    });
    if (proxied) return proxied;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("logs")
      .delete()
      .eq("couple_id", getCoupleId())
      .eq("log_date", date);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
