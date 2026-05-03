const form = document.querySelector("#habitForm");
const dateInput = document.querySelector("#date");
const resetToday = document.querySelector("#resetToday");
const insightsEl = document.querySelector("#insights");
const historyEl = document.querySelector("#history");
const reminderTimeInput = document.querySelector("#reminderTime");
const toggleReminderButton = document.querySelector("#toggleReminder");
const reminderStatus = document.querySelector("#reminderStatus");
const appToast = document.querySelector("#appToast");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js");
}

const fields = {
  wakeTime: document.querySelector("#wakeTime"),
  workStart: document.querySelector("#workStart"),
  workEnd: document.querySelector("#workEnd"),
  sleep: document.querySelector("#sleep"),
  healthyFood: document.querySelector("#healthyFood"),
  moveEveryTwoHours: document.querySelector("#moveEveryTwoHours"),
  stretching: document.querySelector("#stretching"),
  walk15: document.querySelector("#walk15"),
  cardio10: document.querySelector("#cardio10"),
  familyDinner: document.querySelector("#familyDinner"),
  kidsBedtime: document.querySelector("#kidsBedtime"),
  phoneFreeDinner: document.querySelector("#phoneFreeDinner"),
  lateTextNotice: document.querySelector("#lateTextNotice"),
  taekwondoRide: document.querySelector("#taekwondoRide"),
  monthlyFridayLunch: document.querySelector("#monthlyFridayLunch"),
  lateSleepReason: document.querySelector("#lateSleepReason"),
  weekendComputerLimit: document.querySelector("#weekendComputerLimit"),
  note: document.querySelector("#note"),
};

const metricEls = {
  riskScore: document.querySelector("#riskScore"),
  riskLabel: document.querySelector("#riskLabel"),
  avgEnd: document.querySelector("#avgEnd"),
  recoveryScore: document.querySelector("#recoveryScore"),
  streak: document.querySelector("#streak"),
  todayStatus: document.querySelector("#todayStatus"),
  todayNudge: document.querySelector("#todayNudge"),
};

const LOG_KEY = "workHealthLogs";
const REMINDER_KEY = "workHealthReminder";
const canUseVercelApi = location.protocol !== "file:";

const today = new Date();
const yyyyMmDd = formatDate(today);
dateInput.value = yyyyMmDd;
fields.wakeTime.value = "07:00";
fields.workStart.value = "09:00";
fields.workEnd.value = "19:30";
updateSleepFromTimes();

function readLogs() {
  return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
}

function saveLogs(logs) {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function mergeLogs(localLogs, remoteLogs) {
  const byDate = new Map();
  [...localLogs, ...remoteLogs].forEach((log) => {
    if (log?.date) byDate.set(log.date, log);
  });
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

async function syncRemoteLogs() {
  if (canUseVercelApi) {
    try {
      const response = await fetch("/api/logs");
      if (response.ok) {
        const payload = await response.json();
        const remoteLogs = payload.logs.map((row) => ({
          ...row.data,
          date: row.data?.date || row.log_date,
        }));
        saveLogs(mergeLogs(readLogs(), remoteLogs));
        render();
        return;
      }
    } catch (error) {
      // Keep using local-only storage when the API is unavailable.
    }
  }
}

async function saveRemoteLog(log) {
  if (canUseVercelApi) {
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });

      if (response.ok) {
        showToast("기록을 저장했어요.");
        return;
      }
    } catch (error) {
      // Keep using local-only storage when the API is unavailable.
    }
  }
}

async function deleteRemoteLog(date) {
  if (canUseVercelApi) {
    try {
      const response = await fetch(`/api/logs?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });

      if (response.ok) return;
    } catch (error) {
      // Keep using local-only storage when the API is unavailable.
    }
  }
}

function readReminder() {
  return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{"enabled":false,"time":"22:00","lastNotified":""}');
}

function saveReminder(reminder) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminder));
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(total) {
  const minutes = Math.round(total);
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function calculateSleepHours(workEnd, wakeTime) {
  if (!workEnd || !wakeTime) return 0;
  const end = toMinutes(workEnd);
  let wake = toMinutes(wakeTime);
  if (wake <= end) wake += 24 * 60;
  return Math.round(((wake - end) / 60) * 2) / 2;
}

function updateSleepFromTimes() {
  fields.sleep.value = calculateSleepHours(fields.workEnd.value, fields.wakeTime.value);
}

function workHours(log) {
  let end = toMinutes(log.workEnd);
  const start = toMinutes(log.workStart);
  if (end < start) end += 24 * 60;
  return (end - start) / 60;
}

function normalizedWorkEndMinutes(log) {
  let end = toMinutes(log.workEnd);
  const start = toMinutes(log.workStart);
  if (end < start) end += 24 * 60;
  return end;
}

function isLateWorkEnd(log) {
  return normalizedWorkEndMinutes(log) >= 21 * 60;
}

function isAfterOneAmWorkEnd(log) {
  return normalizedWorkEndMinutes(log) >= 25 * 60;
}

function hasHealthyFood(log) {
  return Boolean(log.healthyFood ?? log.meals);
}

function hasMoveEveryTwoHours(log) {
  return Boolean(log.moveEveryTwoHours ?? log.breaks);
}

function hasStretching(log) {
  return Boolean(log.stretching);
}

function hasWalk15(log) {
  return Boolean(log.walk15 ?? log.exercise);
}

function hasCardio10(log) {
  return Boolean(log.cardio10);
}

function calculateRecovery(log) {
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

function calculateRisk(logs) {
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

function calculateStreak(logs) {
  const dates = new Set(logs.map((log) => log.date));
  let count = 0;
  const cursor = new Date();

  while (dates.has(formatDate(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

function buildInsights(logs) {
  const todayLog = logs.find((log) => log.date === dateInput.value);
  const recent = logs.slice(0, 7);

  if (!todayLog) {
    return [
      { type: "caution", text: "오늘 기록을 저장하면 과로 위험과 회복 점수가 바로 업데이트돼요." },
      { type: "", text: "시작은 작게 잡으세요. 퇴근 시간 하나만 꾸준히 기록해도 패턴이 보입니다." },
    ];
  }

  const tips = [];
  const hours = workHours(todayLog);

  if (hours >= 11) {
    tips.push({ type: "warning", text: "오늘 근무 시간이 11시간을 넘었어요. 내일 첫 일정 전 20분 완충 시간을 잡아두면 좋아요." });
  } else if (hours >= 9.5) {
    tips.push({ type: "caution", text: "근무 시간이 길어진 날이에요. 밤에는 업무 메시지 확인을 한 번 끊는 게 우선입니다." });
  } else {
    tips.push({ type: "", text: "근무 시간이 안정권에 가까워요. 이 패턴을 반복할 수 있는 조건을 메모해두세요." });
  }

  if (Number(todayLog.sleep) < 6) {
    tips.push({ type: "warning", text: "수면이 부족합니다. 운동보다 취침 시간을 먼저 회복하는 날로 잡는 편이 좋아요." });
  }

  if (todayLog.wakeTime && toMinutes(todayLog.wakeTime) < 6 * 60) {
    tips.push({ type: "caution", text: "기상 시간이 이른 편이에요. 전날 퇴근이 늦었다면 낮에 짧은 회복 시간을 넣어주세요." });
  }

  if (isAfterOneAmWorkEnd(todayLog)) {
    tips.push({ type: "warning", text: "새벽 1시 이후까지 일한 날이에요. 오늘은 운동보다 수면 회복과 가족에게 이유 공유가 먼저입니다." });
  } else if (isLateWorkEnd(todayLog)) {
    tips.push({ type: "caution", text: "퇴근이 늦었습니다. 내일은 업무 종료 알림을 30분 앞당겨 설정해보세요." });
  }

  if (!hasHealthyFood(todayLog)) {
    tips.push({ type: "caution", text: "건강한 음식을 챙기기 어려웠던 날이에요. 바쁜 날용 고정 메뉴를 하나 정해두면 실패율이 줄어요." });
  }

  if (!hasMoveEveryTwoHours(todayLog)) {
    tips.push({ type: "caution", text: "오래 앉아 있던 시간이 길었어요. 내일은 2시간마다 일어나는 알림을 먼저 잡아보세요." });
  }

  if (!hasWalk15(todayLog) && !hasCardio10(todayLog)) {
    tips.push({ type: "caution", text: "오늘은 몸을 충분히 끌어올리는 움직임이 적었어요. 산책 15분이나 짧은 심박 운동 중 하나만 골라도 좋습니다." });
  }

  if (!todayLog.familyDinner || !todayLog.kidsBedtime) {
    tips.push({ type: "caution", text: "아이들과 보내는 저녁 시간이 빠졌어요. 내일은 짧아도 같이 앉는 시간을 먼저 확보해보세요." });
  } else if (todayLog.phoneFreeDinner) {
    tips.push({ type: "", text: "저녁 시간에 가족과 함께 있고 핸드폰도 내려놓았어요. 회복에 꽤 강한 신호입니다." });
  }

  if (normalizedWorkEndMinutes(todayLog) >= 20 * 60 && !todayLog.lateTextNotice) {
    tips.push({ type: "caution", text: "퇴근이 늦어지는 날에는 미리 문자 한 통이 집의 긴장을 크게 줄여줘요." });
  }

  if (!todayLog.lateSleepReason && isAfterOneAmWorkEnd(todayLog)) {
    tips.push({ type: "caution", text: "새벽 1시를 넘긴 이유를 공유하는 약속은 수면 관리만큼 중요한 신뢰 루틴입니다." });
  }

  if (todayLog.lateTextNotice && todayLog.lateSleepReason) {
    tips.push({ type: "", text: "늦어지는 상황을 미리 공유했어요. 이건 관계의 예측 가능성을 높이는 좋은 신호입니다." });
  }

  if (recent.length >= 3) {
    const avgSleep = recent.reduce((sum, log) => sum + Number(log.sleep), 0) / recent.length;
    if (avgSleep >= 7) {
      tips.push({ type: "", text: "최근 수면 평균이 괜찮습니다. 이건 꽤 중요한 회복 자산이에요." });
    }
  }

  return tips.slice(0, 5);
}

function renderMetrics(logs) {
  const risk = calculateRisk(logs);
  const recent = logs.slice(0, 7);
  const todayLog = logs.find((log) => log.date === formatDate(new Date()));

  metricEls.riskScore.textContent = `${risk}%`;
  metricEls.riskLabel.textContent =
    risk >= 70 ? "이번 주는 개입이 필요해요" : risk >= 40 ? "조금 조심할 구간이에요" : "지금은 관리 가능한 흐름이에요";

  if (recent.length) {
    const averageEnd =
      recent.reduce((sum, log) => {
        let end = toMinutes(log.workEnd);
        if (end < 5 * 60) end += 24 * 60;
        return sum + end;
      }, 0) / recent.length;
    metricEls.avgEnd.textContent = fromMinutes(averageEnd);
    const avgRecovery =
      recent.reduce((sum, log) => sum + calculateRecovery(log), 0) / recent.length;
    metricEls.recoveryScore.textContent = Math.round(avgRecovery);
  } else {
    metricEls.avgEnd.textContent = "--:--";
    metricEls.recoveryScore.textContent = "0";
  }

  metricEls.streak.textContent = `${calculateStreak(logs)}일`;

  if (todayLog) {
    const score = calculateRecovery(todayLog);
    metricEls.todayStatus.textContent = `오늘 회복 점수 ${score}점`;
    metricEls.todayNudge.textContent =
      score >= 75 ? "좋은 흐름이에요. 무리해서 더 채우지 않아도 됩니다." : "작은 회복 행동 하나를 더 챙기면 좋아요.";
  } else {
    metricEls.todayStatus.textContent = "오늘 기록 대기 중";
    metricEls.todayNudge.textContent = "퇴근, 수면, 음식, 움직임을 한 번에 체크하세요.";
  }
}

function renderInsights(logs) {
  insightsEl.innerHTML = "";
  buildInsights(logs).forEach((insight) => {
    const item = document.createElement("li");
    item.className = insight.type;
    item.textContent = insight.text;
    insightsEl.append(item);
  });
}

function renderHistory(logs) {
  historyEl.innerHTML = "";

  if (!logs.length) {
    const empty = document.createElement("p");
    empty.textContent = "아직 저장된 기록이 없어요.";
    empty.style.color = "var(--muted)";
    historyEl.append(empty);
    return;
  }

  logs.slice(0, 10).forEach((log) => {
    const row = document.createElement("article");
    row.className = "history-item";

    const date = document.createElement("div");
    date.className = "history-date";
    date.textContent = log.date;

    const tags = document.createElement("div");
    tags.className = "history-tags";

    [
      `${workHours(log).toFixed(1)}시간 근무`,
      isAfterOneAmWorkEnd(log) ? "새벽 근무" : isLateWorkEnd(log) ? "늦은 퇴근" : "퇴근 안정",
      `${log.wakeTime || "--:--"} 기상`,
      `${log.sleep}시간 수면`,
      hasHealthyFood(log) ? "건강 음식" : "음식 아쉬움",
      hasMoveEveryTwoHours(log) ? "2시간마다 움직임" : "장시간 앉음",
      hasStretching(log) ? "스트레칭" : "스트레칭 없음",
      hasWalk15(log) ? "산책 15분" : "산책 없음",
      hasCardio10(log) ? "심박 운동" : "심박 운동 없음",
      log.familyDinner ? "가족 저녁" : "가족 저녁 없음",
      log.kidsBedtime ? "아이들 취침 함께" : "취침 시간 놓침",
      log.phoneFreeDinner ? "폰 없는 저녁" : "저녁 폰 사용",
      log.lateTextNotice ? "늦퇴 미리 문자" : "늦퇴 문자 없음",
      log.taekwondoRide ? "태권도 라이드" : "라이드 미체크",
      log.monthlyFridayLunch ? "금요일 점심" : "점심 약속 미체크",
      log.lateSleepReason ? "늦은 취침 공유" : "취침 이유 미공유",
      log.weekendComputerLimit ? "주말 컴퓨터 절제" : "주말 컴퓨터 주의",
      `회복 ${calculateRecovery(log)}점`,
    ].forEach((label) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = label;
      tags.append(tag);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-log";
    deleteButton.type = "button";
    deleteButton.title = `${log.date} 기록 삭제`;
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", async () => {
      saveLogs(readLogs().filter((item) => item.date !== log.date));
      render();
      await deleteRemoteLog(log.date);
    });

    row.append(date, tags, deleteButton);
    historyEl.append(row);
  });
}

function render() {
  const logs = readLogs().sort((a, b) => b.date.localeCompare(a.date));
  renderMetrics(logs);
  renderInsights(logs);
  renderHistory(logs);
}

function todayHasLog() {
  return readLogs().some((log) => log.date === formatDate(new Date()));
}

function showToast(message) {
  appToast.textContent = message;
  appToast.classList.add("is-visible");
  window.setTimeout(() => {
    appToast.classList.remove("is-visible");
  }, 4500);
}

function sendReminderNotification() {
  const message = "오늘 상태 기록을 남길 시간이에요. 퇴근, 수면, 건강 루틴을 1분만 체크해요.";

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("회복 루틴 트래커", {
      body: message,
    });
  }

  showToast(message);
}

async function enableReminder() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  const reminder = readReminder();
  saveReminder({
    ...reminder,
    enabled: true,
    time: reminderTimeInput.value || "22:00",
  });
  renderReminder();
  showToast("기록 알림을 켰어요. 앱이 열려 있을 때 정해둔 시간에 알려드릴게요.");
}

function disableReminder() {
  saveReminder({
    ...readReminder(),
    enabled: false,
    time: reminderTimeInput.value || "22:00",
  });
  renderReminder();
  showToast("기록 알림을 껐어요.");
}

function renderReminder() {
  const reminder = readReminder();
  reminderTimeInput.value = reminder.time || "22:00";
  toggleReminderButton.textContent = reminder.enabled ? "알림 끄기" : "알림 켜기";
  toggleReminderButton.classList.toggle("is-on", reminder.enabled);

  if (!reminder.enabled) {
    reminderStatus.textContent = "앱이 열려 있을 때 알림을 보낼 수 있어요.";
  } else if ("Notification" in window && Notification.permission === "denied") {
    reminderStatus.textContent = "브라우저 알림이 차단되어 화면 안 알림만 보여요.";
  } else {
    reminderStatus.textContent = `매일 ${reminder.time || "22:00"}에 기록을 알려드려요.`;
  }
}

function checkReminder() {
  const reminder = readReminder();
  if (!reminder.enabled || todayHasLog()) return;

  const now = new Date();
  const currentDate = formatDate(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const reminderStamp = `${currentDate} ${reminder.time}`;

  if (currentTime === reminder.time && reminder.lastNotified !== reminderStamp) {
    saveReminder({
      ...reminder,
      lastNotified: reminderStamp,
    });
    sendReminderNotification();
  }
}

function loadSelectedDate() {
  const selectedDate = dateInput.value;
  const log = readLogs().find((item) => item.date === dateInput.value);
  if (!log) {
    form.reset();
    dateInput.value = selectedDate || yyyyMmDd;
    fields.wakeTime.value = "07:00";
    fields.workStart.value = "09:00";
    fields.workEnd.value = "19:30";
    updateSleepFromTimes();
    return;
  }

  fields.wakeTime.value = log.wakeTime || "07:00";
  fields.workStart.value = log.workStart;
  fields.workEnd.value = log.workEnd;
  updateSleepFromTimes();
  fields.healthyFood.checked = hasHealthyFood(log);
  fields.moveEveryTwoHours.checked = hasMoveEveryTwoHours(log);
  fields.stretching.checked = hasStretching(log);
  fields.walk15.checked = hasWalk15(log);
  fields.cardio10.checked = hasCardio10(log);
  fields.familyDinner.checked = Boolean(log.familyDinner);
  fields.kidsBedtime.checked = Boolean(log.kidsBedtime);
  fields.phoneFreeDinner.checked = Boolean(log.phoneFreeDinner);
  fields.lateTextNotice.checked = Boolean(log.lateTextNotice);
  fields.taekwondoRide.checked = Boolean(log.taekwondoRide);
  fields.monthlyFridayLunch.checked = Boolean(log.monthlyFridayLunch);
  fields.lateSleepReason.checked = Boolean(log.lateSleepReason);
  fields.weekendComputerLimit.checked = Boolean(log.weekendComputerLimit);
  fields.note.value = log.note;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateSleepFromTimes();
  const log = {
    date: dateInput.value,
    wakeTime: fields.wakeTime.value,
    workStart: fields.workStart.value,
    workEnd: fields.workEnd.value,
    sleep: calculateSleepHours(fields.workEnd.value, fields.wakeTime.value),
    healthyFood: fields.healthyFood.checked,
    moveEveryTwoHours: fields.moveEveryTwoHours.checked,
    stretching: fields.stretching.checked,
    walk15: fields.walk15.checked,
    cardio10: fields.cardio10.checked,
    familyDinner: fields.familyDinner.checked,
    kidsBedtime: fields.kidsBedtime.checked,
    phoneFreeDinner: fields.phoneFreeDinner.checked,
    lateTextNotice: fields.lateTextNotice.checked,
    taekwondoRide: fields.taekwondoRide.checked,
    monthlyFridayLunch: fields.monthlyFridayLunch.checked,
    lateSleepReason: fields.lateSleepReason.checked,
    weekendComputerLimit: fields.weekendComputerLimit.checked,
    note: fields.note.value.trim(),
  };

  const logs = readLogs().filter((item) => item.date !== log.date);
  logs.push(log);
  saveLogs(logs.sort((a, b) => b.date.localeCompare(a.date)));
  render();
  await saveRemoteLog(log);
});

dateInput.addEventListener("change", () => {
  loadSelectedDate();
  renderInsights(readLogs());
});

resetToday.addEventListener("click", () => {
  const selectedDate = dateInput.value;
  form.reset();
  dateInput.value = selectedDate;
  fields.wakeTime.value = "07:00";
  fields.workStart.value = "09:00";
  fields.workEnd.value = "19:30";
  updateSleepFromTimes();
});

fields.wakeTime.addEventListener("change", updateSleepFromTimes);
fields.workEnd.addEventListener("change", updateSleepFromTimes);

reminderTimeInput.addEventListener("change", () => {
  saveReminder({
    ...readReminder(),
    time: reminderTimeInput.value || "22:00",
  });
  renderReminder();
});

toggleReminderButton.addEventListener("click", () => {
  if (readReminder().enabled) {
    disableReminder();
  } else {
    enableReminder();
  }
});

render();
renderReminder();
checkReminder();
syncRemoteLogs();
window.setInterval(checkReminder, 30000);
