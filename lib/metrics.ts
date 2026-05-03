import type { LogEntry } from "./types";

export function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number) {
  const minutes = Math.round(total);
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function calculateSleepHours(workEnd: string, wakeTime: string) {
  if (!workEnd || !wakeTime) return 0;
  const end = toMinutes(workEnd);
  let wake = toMinutes(wakeTime);
  if (wake <= end) wake += 24 * 60;
  return Math.round(((wake - end) / 60) * 2) / 2;
}

export function workHours(log: LogEntry) {
  let end = toMinutes(log.workEnd);
  const start = toMinutes(log.workStart);
  if (end < start) end += 24 * 60;
  return (end - start) / 60;
}

export function normalizedWorkEndMinutes(log: LogEntry) {
  let end = toMinutes(log.workEnd);
  const start = toMinutes(log.workStart);
  if (end < start) end += 24 * 60;
  return end;
}

export function isLateWorkEnd(log: LogEntry) {
  return normalizedWorkEndMinutes(log) >= 21 * 60;
}

export function isAfterOneAmWorkEnd(log: LogEntry) {
  return normalizedWorkEndMinutes(log) >= 25 * 60;
}

export function hasHealthyFood(log: LogEntry) {
  return Boolean(log.healthyFood ?? log.meals);
}

export function hasMoveEveryTwoHours(log: LogEntry) {
  return Boolean(log.moveEveryTwoHours ?? log.breaks);
}

export function hasStretching(log: LogEntry) {
  return Boolean(log.stretching);
}

export function hasWalk15(log: LogEntry) {
  return Boolean(log.walk15 ?? log.exercise);
}

export function hasCardio10(log: LogEntry) {
  return Boolean(log.cardio10);
}

export function calculateRecovery(log: LogEntry) {
  let score = 30;
  score += Math.min(Number(log.sleep), 8) * 5;
  score += hasHealthyFood(log) ? 8 : 0;
  score += hasMoveEveryTwoHours(log) ? 8 : 0;
  score += hasStretching(log) ? 6 : 0;
  score += hasWalk15(log) ? 8 : 0;
  score += hasCardio10(log) ? 8 : 0;
  score += log.familyDinner ? 5 : 0;
  score += log.kidsBedtime ? 5 : 0;
  score += log.phoneFreeDinner ? 5 : 0;
  score += log.lateTextNotice ? 3 : 0;
  score += log.taekwondoRide ? 3 : 0;
  score += log.monthlyFridayLunch ? 3 : 0;
  score += log.lateSleepReason ? 3 : 0;
  score += log.weekendComputerLimit ? 3 : 0;
  score -= workHours(log) > 10 ? 12 : 0;
  score -= isLateWorkEnd(log) ? 10 : 0;
  score -= isAfterOneAmWorkEnd(log) ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRisk(logs: LogEntry[]) {
  if (!logs.length) return 0;
  const recent = logs.slice(0, 7);
  let risk = 0;
  recent.forEach((log) => {
    risk += workHours(log) >= 10 ? 18 : 4;
    risk += isLateWorkEnd(log) ? 14 : 0;
    risk += isAfterOneAmWorkEnd(log) ? 12 : 0;
    risk += Number(log.sleep) < 6 ? 16 : 0;
    risk += !hasHealthyFood(log) ? 6 : 0;
    risk += !hasMoveEveryTwoHours(log) ? 6 : 0;
    risk += !hasStretching(log) ? 4 : 0;
    risk += !hasWalk15(log) ? 5 : 0;
    risk += !hasCardio10(log) ? 5 : 0;
    risk += !log.familyDinner ? 4 : 0;
    risk += !log.kidsBedtime ? 4 : 0;
    risk += !log.phoneFreeDinner ? 4 : 0;
    risk += !log.lateTextNotice ? 2 : 0;
    risk += !log.lateSleepReason ? 2 : 0;
    risk += !log.weekendComputerLimit ? 2 : 0;
  });
  return Math.min(100, Math.round(risk / recent.length));
}

export function calculateStreak(logs: LogEntry[]) {
  const dates = new Set(logs.map((log) => log.date));
  let count = 0;
  const cursor = new Date();
  while (dates.has(formatDate(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
