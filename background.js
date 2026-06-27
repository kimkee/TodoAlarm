// TodoAlarm Chrome Extension - Background Service Worker (Manifest V3)

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
  
  if (alarm.name.startsWith("alarm|")) {
    const parts = alarm.name.split("|");
    const reminderId = parts[1];

    chrome.storage.local.get(["reminders"], (result) => {
      const reminders = result.reminders || [];
      const reminder = reminders.find((r) => r.id === reminderId);
      if (reminder && reminder.enabled) {
        showNotification(reminder);
      }
    });
  } else if (alarm.name.startsWith("snooze|")) {
    // snooze 알람 정보 조회
    chrome.storage.local.get([alarm.name], (result) => {
      const details = result[alarm.name];
      if (details) {
        // 임시 저장된 상세 정보가 있으면 그 정보로 알림 노출
        showNotification(details);
        chrome.storage.local.remove(alarm.name);
      } else {
        // 저장된 상세 정보가 없는 일반 알람인 경우 원래 리마인더 검색
        const parts = alarm.name.split("|");
        const reminderId = parts[1];
        chrome.storage.local.get(["reminders"], (res) => {
          const reminders = res.reminders || [];
          const reminder = reminders.find((r) => r.id === reminderId);
          if (reminder && reminder.enabled) {
            showNotification(reminder);
          }
        });
      }
    });

    // 1회성 알람이므로 명시적으로 제거
    chrome.alarms.clear(alarm.name);
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
    showNotification(testReminder)
      .then((createdId) => sendResponse({ success: true, id: createdId }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 비동기 응답 지원
  }
});

// 알림(Notification) 클릭 및 버튼 클릭 이벤트 리스너
chrome.notifications.onClicked.addListener((notificationId) => {
  handleNotificationClick(notificationId);
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    handleNotificationClick(notificationId);
  } else if (buttonIndex === 1) {
    handleSnooze(notificationId);
  }
});

// 알림이 닫힐 때 임시 저장 스토리지 정리
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (notificationId.startsWith("todoalarm|")) {
    chrome.storage.local.remove(notificationId);
  }
});

// 알림 노출 처리 함수 (Promise 형태로 에러 전달 가능)
function showNotification(reminder) {
  return new Promise((resolve, reject) => {
    // 50자 이하의 매우 심플한 고유 ID 생성 (todoalarm|아이디|타임스탬프)
    const notificationId = `todoalarm|${reminder.id}|${Date.now()}`;
    const iconUrl = chrome.runtime.getURL("icons/icon128.png");

    // 알림에 대응되는 상세 정보를 스토리지에 매핑 저장 (ID 길이 500자 제한 우회)
    const details = {
      id: reminder.id,
      title: reminder.title,
      message: reminder.message,
      url: reminder.url
    };

    chrome.storage.local.set({ [notificationId]: details }, () => {
      chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: iconUrl,
        title: reminder.title || "알림",
        message: reminder.message || "설정하신 알림 시간입니다.",
        buttons: [
          { title: "사이트 열기" },
          { title: "10분 뒤 다시 알림" }
        ],
        requireInteraction: true // 사용자가 닫기 전까지 떠 있도록 함
      }, (createdId) => {
        if (chrome.runtime.lastError) {
          console.error("Notification Error:", chrome.runtime.lastError.message);
          // 실패 시 스토리지 정리
          chrome.storage.local.remove(notificationId);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log("Notification created successfully:", createdId);
          resolve(createdId);
        }
      });
    });
  });
}

// 알림 클릭 핸들링 함수
function handleNotificationClick(notificationId) {
  if (notificationId.startsWith("todoalarm|")) {
    chrome.storage.local.get([notificationId], (result) => {
      const details = result[notificationId];
      if (details && details.url) {
        chrome.tabs.create({ url: details.url });
      }
      // 클릭했으므로 스토리지 정리 및 알림 제거
      chrome.storage.local.remove(notificationId);
      chrome.notifications.clear(notificationId);
    });
  }
}

// 10분 재알림(Snooze) 설정 함수
function handleSnooze(notificationId) {
  if (notificationId.startsWith("todoalarm|")) {
    chrome.storage.local.get([notificationId], (result) => {
      const details = result[notificationId];
      if (details) {
        // 알람명 자체를 짧게 만들고 데이터를 스토리지에 바인딩
        const snoozeAlarmName = `snooze|${details.id}|${Date.now()}`;
        
        chrome.storage.local.set({ [snoozeAlarmName]: details }, () => {
          chrome.alarms.create(snoozeAlarmName, {
            delayInMinutes: 10
          });
          console.log(`Scheduled snooze alarm: ${snoozeAlarmName} in 10 minutes`);
        });
      }
      
      // 기존 알림 스토리지 제거 및 알림창 제거
      chrome.storage.local.remove(notificationId);
      chrome.notifications.clear(notificationId);
    });
  }
}

// 크롬 알람(alarms) 동기화 함수
async function syncAlarms() {
  // 정기 알람만 찾아서 초기화 (진행 중인 snooze 재알림은 지우지 않고 유지)
  const alarms = await chrome.alarms.getAll();
  for (const alarm of alarms) {
    if (alarm.name.startsWith("alarm|")) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  const result = await chrome.storage.local.get(["reminders"]);
  const reminders = result.reminders || [];

  for (const reminder of reminders) {
    if (reminder.enabled && reminder.days && reminder.days.length > 0) {
      for (const day of reminder.days) {
        const nextTime = getNextAlarmTime(day, reminder.time);
        const alarmName = `alarm|${reminder.id}|${day}`;
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
