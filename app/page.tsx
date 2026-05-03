"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  calculateRecovery,
  calculateRisk,
  calculateSleepHours,
  calculateStreak,
  formatDate,
  fromMinutes,
  hasCardio10,
  hasHealthyFood,
  hasMoveEveryTwoHours,
  hasStretching,
  hasWalk15,
  isAfterOneAmWorkEnd,
  isLateWorkEnd,
  toMinutes,
  workHours,
} from "@/lib/metrics";
import type { LogEntry, ReminderState, SupabaseLogRow } from "@/lib/types";

const LOG_KEY = "workHealthLogs";
const REMINDER_KEY = "workHealthReminder";

const checkGroups: { title: string; items: [keyof LogEntry, string][] }[] = [
  {
    title: "건강 루틴",
    items: [
      ["healthyFood", "건강한 음식 먹으려 노력함"],
      ["moveEveryTwoHours", "적어도 2시간에 한번은 일어나서 움직임"],
      ["stretching", "스트레칭"],
      ["walk15", "산책 15분 이상"],
      ["cardio10", "심장 빠르게 뛰는 운동 10분 이상"],
    ],
  },
  {
    title: "저녁 시간 루틴",
    items: [
      ["familyDinner", "아이들과 함께 저녁 먹음"],
      ["kidsBedtime", "아이들 재울때 까지 시간 같이 보냄"],
      ["phoneFreeDinner", "저녁 시간 동안 핸드폰 보지 않았음"],
    ],
  },
  {
    title: "와이프와의 약속",
    items: [
      ["lateTextNotice", "퇴근 시간이 늦어질 경우 미리 문자"],
      ["taekwondoRide", "수요일 윤모 태권도 라이드"],
      ["monthlyFridayLunch", "한달에 한번 금요일 점심"],
      ["lateSleepReason", "잠자는 시간이 새벽 1시가 지날때는 이유를 와이프에게 알려줄것"],
      ["weekendComputerLimit", "주말에는 되도록 컴퓨터 앞에 앉지 않기"],
    ],
  },
];

function emptyLog(date = formatDate(new Date())): LogEntry {
  return {
    date,
    wakeTime: "07:00",
    workStart: "09:00",
    workEnd: "19:30",
    sleep: calculateSleepHours("19:30", "07:00"),
    healthyFood: false,
    moveEveryTwoHours: false,
    stretching: false,
    walk15: false,
    cardio10: false,
    familyDinner: false,
    kidsBedtime: false,
    phoneFreeDinner: false,
    lateTextNotice: false,
    taekwondoRide: false,
    monthlyFridayLunch: false,
    lateSleepReason: false,
    weekendComputerLimit: false,
    note: "",
  };
}

function readLogs() {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(LOG_KEY) || "[]") as LogEntry[];
}

function writeLogs(logs: LogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function readReminder(): ReminderState {
  if (typeof window === "undefined") return { enabled: false, time: "22:00", lastNotified: "" };
  return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{"enabled":false,"time":"22:00","lastNotified":""}');
}

function writeReminder(reminder: ReminderState) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminder));
}

function mergeLogs(localLogs: LogEntry[], remoteRows: SupabaseLogRow[]) {
  const byDate = new Map(localLogs.map((log) => [log.date, log]));
  remoteRows.forEach((row) => byDate.set(row.log_date, { ...row.data, date: row.data?.date || row.log_date }));
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function buildInsights(log?: LogEntry) {
  if (!log) return ["오늘 기록을 저장하면 과로 위험과 회복 점수가 업데이트돼요."];
  const tips = [];
  if (workHours(log) >= 10) tips.push("근무 시간이 긴 날이에요. 내일은 업무 종료 알림을 조금 앞당겨보세요.");
  if (Number(log.sleep) < 6) tips.push("수면이 부족합니다. 운동보다 취침 시간 회복이 먼저예요.");
  if (isAfterOneAmWorkEnd(log)) tips.push("새벽 1시 이후까지 일했어요. 이유 공유와 수면 회복을 우선으로 잡아주세요.");
  if (!hasHealthyFood(log) || !hasMoveEveryTwoHours(log)) tips.push("음식과 움직임 둘 중 하나만 챙겨도 회복 점수가 달라져요.");
  if (!log.familyDinner || !log.kidsBedtime) tips.push("아이들과 보내는 저녁 시간이 빠졌어요. 짧아도 같이 앉는 시간을 먼저 잡아보세요.");
  return tips.length ? tips : ["오늘은 회복 신호가 좋아요. 이 흐름을 반복할 수 있게 메모해두세요."];
}

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [formLog, setFormLog] = useState<LogEntry>(emptyLog());
  const [reminder, setReminder] = useState<ReminderState>({ enabled: false, time: "22:00", lastNotified: "" });
  const [toast, setToast] = useState("");

  const recent = logs.slice(0, 7);
  const todayLog = logs.find((log) => log.date === formatDate(new Date()));
  const selectedLog = logs.find((log) => log.date === formLog.date);
  const risk = calculateRisk(logs);
  const recoveryScore = recent.length
    ? Math.round(recent.reduce((sum, log) => sum + calculateRecovery(log), 0) / recent.length)
    : 0;
  const averageEnd = recent.length
    ? fromMinutes(recent.reduce((sum, log) => sum + (toMinutes(log.workEnd) < 300 ? toMinutes(log.workEnd) + 1440 : toMinutes(log.workEnd)), 0) / recent.length)
    : "--:--";
  const insights = useMemo(() => buildInsights(selectedLog), [selectedLog]);

  function show(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4200);
  }

  function updateForm(patch: Partial<LogEntry>) {
    setFormLog((current) => {
      const next = { ...current, ...patch };
      return { ...next, sleep: calculateSleepHours(next.workEnd, next.wakeTime) };
    });
  }

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    const localLogs = readLogs().sort((a, b) => b.date.localeCompare(a.date));
    setLogs(localLogs);
    setReminder(readReminder());
    fetch("/api/logs")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { logs: SupabaseLogRow[] } | null) => {
        if (!payload) return;
        const merged = mergeLogs(readLogs(), payload.logs);
        writeLogs(merged);
        setLogs(merged);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const existing = logs.find((log) => log.date === formLog.date);
    if (existing) setFormLog({ ...existing, sleep: calculateSleepHours(existing.workEnd, existing.wakeTime) });
  }, [formLog.date, logs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!reminder.enabled || logs.some((log) => log.date === formatDate(new Date()))) return;
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const stamp = `${formatDate(now)} ${reminder.time}`;
      if (currentTime !== reminder.time || reminder.lastNotified === stamp) return;
      const next = { ...reminder, lastNotified: stamp };
      writeReminder(next);
      setReminder(next);
      const message = "오늘 상태 기록을 남길 시간이에요.";
      if ("Notification" in window && Notification.permission === "granted") new Notification("회복 루틴 트래커", { body: message });
      show(message);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [logs, reminder]);

  async function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const log = { ...formLog, sleep: calculateSleepHours(formLog.workEnd, formLog.wakeTime) };
    const next = [...logs.filter((item) => item.date !== log.date), log].sort((a, b) => b.date.localeCompare(a.date));
    writeLogs(next);
    setLogs(next);
    try {
      const response = await fetch("/api/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(log) });
      show(response.ok ? "기록을 저장했어요." : "이 기기에는 저장해뒀어요.");
    } catch {
      show("이 기기에는 저장해뒀어요.");
    }
  }

  async function deleteLog(date: string) {
    const next = logs.filter((log) => log.date !== date);
    writeLogs(next);
    setLogs(next);
    await fetch(`/api/logs?date=${encodeURIComponent(date)}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function toggleReminder() {
    if (!reminder.enabled && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    const next = { ...reminder, enabled: !reminder.enabled };
    writeReminder(next);
    setReminder(next);
    show(next.enabled ? "기록 알림을 켰어요." : "기록 알림을 껐어요.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Work-Life Reset</p>
          <h1>회복 루틴 트래커</h1>
          <p className="intro">매일의 신호를 보이게 만들어 과로, 회복, 가족 시간을 같이 관리해요.</p>
        </div>
        <div className="pulse-panel">
          <span className="pulse-dot" aria-hidden="true" />
          <div>
            <strong>{todayLog ? `오늘 회복 점수 ${calculateRecovery(todayLog)}점` : "오늘 기록 대기 중"}</strong>
            <p>{todayLog ? "좋은 것과 아쉬운 것을 같이 봐요." : "퇴근, 수면, 음식, 움직임을 체크하세요."}</p>
          </div>
        </div>
        <div className="reminder-panel">
          <label>
            기록 알림 시간
            <input type="time" value={reminder.time} onChange={(event) => {
              const next = { ...reminder, time: event.target.value || "22:00" };
              writeReminder(next);
              setReminder(next);
            }} />
          </label>
          <button className={reminder.enabled ? "is-on" : ""} type="button" onClick={toggleReminder}>
            {reminder.enabled ? "알림 끄기" : "알림 켜기"}
          </button>
          <p>{reminder.enabled ? `매일 ${reminder.time}에 알려드려요.` : "앱이 열려 있을 때 알림을 보낼 수 있어요."}</p>
        </div>
        <nav className="section-nav">
          <a href="#log">오늘 기록</a>
          <a href="#dashboard">패턴 보기</a>
        </nav>
      </aside>

      <main>
        <section className="hero-strip">
          <div className="hero-copy">
            <p>밤늦게까지 켜진 노트북보다 먼저 챙길 것</p>
            <strong>몸의 신호, 쉬는 시간, 같이 먹는 저녁</strong>
          </div>
        </section>

        <section id="dashboard" className="summary-dashboard">
          <div className="summary-main">
            <span>이번 주 요약</span>
            <strong>{risk}%</strong>
            <small>{risk >= 70 ? "이번 주는 개입이 필요해요" : risk >= 40 ? "조금 조심할 구간이에요" : "관리 가능한 흐름이에요"}</small>
          </div>
          <div className="summary-stats">
            <Stat label="평균 퇴근" value={averageEnd} />
            <Stat label="회복 점수" value={String(recoveryScore)} />
            <Stat label="연속 기록" value={`${calculateStreak(logs)}일`} />
          </div>
        </section>

        <section id="log" className="workspace">
          <form className="log-panel" onSubmit={submitLog}>
            <div className="section-heading">
              <p className="eyebrow">Daily Check-in</p>
              <h2>오늘 상태 기록</h2>
            </div>
            <div className="form-grid">
              <Field label="날짜" type="date" value={formLog.date} onChange={(value) => updateForm({ date: value })} />
              <Field label="기상 시간" type="time" value={formLog.wakeTime} onChange={(value) => updateForm({ wakeTime: value })} />
              <Field label="근무 시작" type="time" value={formLog.workStart} onChange={(value) => updateForm({ workStart: value })} />
              <Field label="근무 종료" type="time" value={formLog.workEnd} onChange={(value) => updateForm({ workEnd: value })} />
              <label>수면 시간 자동 계산<input type="number" value={formLog.sleep} readOnly required /></label>
            </div>
            {checkGroups.map((group) => <CheckGroup key={group.title} group={group} log={formLog} update={updateForm} />)}
            <label>오늘의 메모<textarea rows={4} value={formLog.note} onChange={(event) => updateForm({ note: event.target.value })} /></label>
            <div className="actions">
              <button type="submit">기록 저장</button>
              <button type="button" className="secondary" onClick={() => setFormLog(emptyLog(formLog.date))}>오늘 입력 비우기</button>
            </div>
          </form>

          <aside className="insight-panel">
            <div className="section-heading">
              <p className="eyebrow">Coach Notes</p>
              <h2>오늘의 신호</h2>
            </div>
            <ul className="insight-list">{insights.map((text) => <li key={text}>{text}</li>)}</ul>
          </aside>
        </section>

        <section className="history-section">
          <div className="section-heading">
            <p className="eyebrow">Recent Logs</p>
            <h2>최근 기록</h2>
          </div>
          <div className="history-list">
            {logs.length ? logs.slice(0, 10).map((log) => (
              <article className="history-item" key={log.date}>
                <div className="history-date">{log.date}</div>
                <div className="history-tags">{historyTags(log).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
                <button className="delete-log" type="button" onClick={() => deleteLog(log.date)}>x</button>
              </article>
            )) : <p className="empty-state">아직 저장된 기록이 없어요.</p>}
          </div>
        </section>
      </main>
      <div className={`app-toast ${toast ? "is-visible" : ""}`} role="status">{toast}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}

function CheckGroup({ group, log, update }: { group: { title: string; items: [keyof LogEntry, string][] }; log: LogEntry; update: (patch: Partial<LogEntry>) => void }) {
  return (
    <fieldset className="checks">
      <legend>{group.title}</legend>
      {group.items.map(([key, label]) => (
        <label key={String(key)}>
          <input type="checkbox" checked={Boolean(log[key])} onChange={(event) => update({ [key]: event.target.checked } as Partial<LogEntry>)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function historyTags(log: LogEntry) {
  return [
    `${workHours(log).toFixed(1)}시간 근무`,
    isAfterOneAmWorkEnd(log) ? "새벽 근무" : isLateWorkEnd(log) ? "늦은 퇴근" : "퇴근 안정",
    `${log.wakeTime} 기상`,
    `${log.sleep}시간 수면`,
    hasHealthyFood(log) ? "건강 음식" : "음식 아쉬움",
    hasMoveEveryTwoHours(log) ? "2시간마다 움직임" : "장시간 앉음",
    hasStretching(log) ? "스트레칭" : "스트레칭 없음",
    hasWalk15(log) ? "산책 15분" : "산책 없음",
    hasCardio10(log) ? "심박 운동" : "심박 운동 없음",
    log.familyDinner ? "가족 저녁" : "가족 저녁 없음",
    `회복 ${calculateRecovery(log)}점`,
  ];
}
