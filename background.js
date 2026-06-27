// LottoAlarm Chrome Extension - Background Service Worker (Manifest V3)

// 기본 알람 설정 (매주 월/금 오전 10시)
const DEFAULT_REMINDERS = [
  {
    id: "lotto_default",
    title: "로또 구매 알리미 🍀",
    message: "잊지 말고 온라인 로또를 구매하세요! 아래 버튼을 누르면 구매 화면으로 이동합니다.",
    url: "https://www.dhlottery.co.kr/mypage/mylotteryledger",
    days: [1, 5], // 1 = 월요일, 5 = 금요일 (0 = 일요일, 6 = 토요일)
    time: "10:00",
    enabled: true
  }
];

// 설치 또는 브라우저 시작 시 기본값 초기화 및 알람 등록
chrome.runtime.onInstalled.addListener(async (details) => {
  const result = await chrome.storage.local.get(["reminders"]);
  if (!result.reminders) {
    await chrome.storage.local.set({ reminders: DEFAULT_REMINDERS });
  }
  await syncAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncAlarms();
});

// 알람(Alarm) 이벤트 수신
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("Alarm triggered:", alarm.name);
  if (alarm.name.startsWith("alarm_")) {
    const parts = alarm.name.split("_");
    const reminderId = parts[1];

    chrome.storage.local.get(["reminders"], (result) => {
      const reminders = result.reminders || [];
      const reminder = reminders.find((r) => r.id === reminderId);
      if (reminder && reminder.enabled) {
        showNotification(reminder);
      }
    });
  }
});

// 메시지 수신 (팝업과의 동기화 및 테스트 동작)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sync_alarms") {
    syncAlarms()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 비동기 응답 지원
  } else if (message.type === "test_notification") {
    const { title, message: msgText, url } = message.data;
    const testReminder = {
      id: "test_" + Date.now(),
      title: title || "테스트 알림 🔔",
      message: msgText || "설정한 테스트 알림이 정상 작동 중입니다.",
      url: url || "https://www.dhlottery.co.kr/mypage/mylotteryledger"
    };
    showNotification(testReminder);
    sendResponse({ success: true });
  }
});

// 알림(Notification) 클릭 및 버튼 클릭 이벤트 리스너
chrome.notifications.onClicked.addListener((notificationId) => {
  handleNotificationClick(notificationId);
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  handleNotificationClick(notificationId);
});

// 알림 노출 처리 함수
function showNotification(reminder) {
  // 알림 고유 ID에 구분값 및 이동할 URL 포함하여 전달 (Stateless 처리)
  const notificationId = `lottoalarm|${reminder.id}|${encodeURIComponent(reminder.url)}|${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: reminder.title || "알림",
    message: reminder.message || "설정하신 알림 시간입니다.",
    buttons: [
      { title: "사이트 열기" }
    ],
    requireInteraction: true // 사용자가 닫기 전까지 떠 있도록 함
  });
}

// 알림 클릭 핸들링 함수
function handleNotificationClick(notificationId) {
  if (notificationId.startsWith("lottoalarm|")) {
    const parts = notificationId.split("|");
    const url = decodeURIComponent(parts[2]);
    if (url) {
      chrome.tabs.create({ url: url });
    }
    chrome.notifications.clear(notificationId);
  }
}

// 크롬 알람(alarms) 동기화 함수
async function syncAlarms() {
  await chrome.alarms.clearAll();
  const result = await chrome.storage.local.get(["reminders"]);
  const reminders = result.reminders || [];

  for (const reminder of reminders) {
    if (reminder.enabled && reminder.days && reminder.days.length > 0) {
      for (const day of reminder.days) {
        const nextTime = getNextAlarmTime(day, reminder.time);
        const alarmName = `alarm_${reminder.id}_day_${day}`;
        chrome.alarms.create(alarmName, {
          when: nextTime,
          periodInMinutes: 10080 // 1주일 주기 (7일 * 24시간 * 60분 = 10080)
        });
        console.log(`Scheduled alarm: ${alarmName} at ${new Date(nextTime).toLocaleString()}`);
      }
    }
  }
}

// 요일 및 시간 기준 다음 스케줄 타임스탬프 반환 함수
function getNextAlarmTime(dayOfWeek, timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const now = new Date();
  let target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  // 요일 차이 계산 (JS: 0 = 일요일, ..., 6 = 토요일)
  let daysDiff = (dayOfWeek - now.getDay() + 7) % 7;

  // 만약 요일이 오늘인데 설정 시간이 이미 지났다면, 1주일 뒤로 예약
  if (daysDiff === 0 && target.getTime() <= now.getTime()) {
    daysDiff = 7;
  }

  target.setDate(now.getDate() + daysDiff);
  return target.getTime();
}
