// LottoAlarm Chrome Extension - Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  // DOM 요소 선택
  const alarmList = document.getElementById("alarm-list");
  const btnShowAddForm = document.getElementById("btn-show-add-form");
  const formContainer = document.getElementById("form-container");
  const alarmForm = document.getElementById("alarm-form");
  const editId = document.getElementById("edit-id");
  const alarmName = document.getElementById("alarm-name");
  const alarmMessage = document.getElementById("alarm-message");
  const alarmUrl = document.getElementById("alarm-url");
  const alarmTime = document.getElementById("alarm-time");
  const btnCancel = document.getElementById("btn-cancel");
  const formTitle = document.getElementById("form-title");
  const dayError = document.getElementById("day-error");
  const dayChips = document.querySelectorAll(".day-chip");

  // 요일 이름 매핑 (0 = 일요일, 6 = 토요일)
  const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  // 현재 활성화된 요일 목록
  let activeDays = [];

  // 요일 칩 클릭 이벤트 리스너 추가
  dayChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
      const dayVal = parseInt(chip.dataset.day, 10);
      
      if (chip.classList.contains("active")) {
        if (!activeDays.includes(dayVal)) {
          activeDays.push(dayVal);
        }
      } else {
        activeDays = activeDays.filter((d) => d !== dayVal);
      }
      
      if (activeDays.length > 0) {
        dayError.classList.add("hidden");
      }
    });
  });

  // 알람 리스트 가져와서 렌더링하기
  function loadAndRenderReminders() {
    chrome.storage.local.get(["reminders"], (result) => {
      const reminders = result.reminders || [];
      renderReminders(reminders);
    });
  }

  // 알람 카드 렌더링 함수
  function renderReminders(reminders) {
    alarmList.innerHTML = "";

    if (reminders.length === 0) {
      alarmList.innerHTML = `
        <div class="empty-state">
          <svg class="icon-empty" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <p>등록된 알람 일정이 없습니다.</p>
        </div>
      `;
      return;
    }

    reminders.forEach((reminder) => {
      const card = document.createElement("div");
      card.className = `alarm-card ${reminder.enabled ? "" : "disabled"}`;
      card.id = `card-${reminder.id}`;

      // 요일 표시 텍스트 포맷팅
      const formattedDays = formatDaysText(reminder.days);
      const displayUrl = reminder.url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 30) + (reminder.url.length > 30 ? "..." : "");

      card.innerHTML = `
        <div class="alarm-card-header">
          <div class="alarm-card-info">
            <h3 class="alarm-card-title">${escapeHtml(reminder.title)}</h3>
            <div class="alarm-card-schedule">
              ${formattedDays} &bull; ${reminder.time}
            </div>
            <div class="alarm-card-url" title="${escapeHtml(reminder.url)}">
              <svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
              ${escapeHtml(displayUrl)}
            </div>
          </div>
          <div class="alarm-card-controls">
            <label class="switch">
              <input type="checkbox" class="toggle-enabled" data-id="${reminder.id}" ${reminder.enabled ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="alarm-card-actions">
          <button class="btn-icon btn-test" data-id="${reminder.id}" title="테스트 알림 받기">
            <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          </button>
          <button class="btn-icon btn-edit" data-id="${reminder.id}" title="수정">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="btn-icon delete btn-delete" data-id="${reminder.id}" title="삭제">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

      alarmList.appendChild(card);
    });

    // 이벤트 리스너 바인딩
    bindCardEvents();
  }

  // 카드 내부 버튼(토글, 테스트, 수정, 삭제) 이벤트 바인딩
  function bindCardEvents() {
    // 활성/비활성 토글 스위치
    document.querySelectorAll(".toggle-enabled").forEach((toggle) => {
      toggle.addEventListener("change", (e) => {
        const id = e.target.dataset.id;
        const enabled = e.target.checked;
        
        // 카드 엘리먼트 투명도 처리
        const card = document.getElementById(`card-${id}`);
        if (card) {
          if (enabled) {
            card.classList.remove("disabled");
          } else {
            card.classList.add("disabled");
          }
        }

        updateReminderEnabled(id, enabled);
      });
    });

    // 테스트 알림 발송 버튼
    document.querySelectorAll(".btn-test").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        chrome.storage.local.get(["reminders"], (result) => {
          const reminders = result.reminders || [];
          const reminder = reminders.find((r) => r.id === id);
          if (reminder) {
            chrome.runtime.sendMessage({
              type: "test_notification",
              data: {
                title: `[테스트] ${reminder.title}`,
                message: reminder.message,
                url: reminder.url
              }
            });
          }
        });
      });
    });

    // 수정 버튼
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        chrome.storage.local.get(["reminders"], (result) => {
          const reminders = result.reminders || [];
          const reminder = reminders.find((r) => r.id === id);
          if (reminder) {
            openEditForm(reminder);
          }
        });
      });
    });

    // 삭제 버튼
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("이 알림 일정을 삭제하시겠습니까?")) {
          deleteReminder(id);
        }
      });
    });
  }

  // 폼 열기 (추가 모드)
  btnShowAddForm.addEventListener("click", () => {
    resetForm();
    formTitle.textContent = "알림 일정 추가";
    formContainer.classList.remove("hidden");
    // 추가 폼을 화면에 띄운 후 입력창 포커스 및 부드럽게 스크롤
    alarmName.focus();
    formContainer.scrollIntoView({ behavior: "smooth" });
  });

  // 취소 버튼
  btnCancel.addEventListener("click", () => {
    formContainer.classList.add("hidden");
    resetForm();
  });

  // 폼 초기화 함수
  function resetForm() {
    editId.value = "";
    alarmName.value = "";
    alarmMessage.value = "";
    alarmUrl.value = "";
    alarmTime.value = "";
    activeDays = [];
    dayChips.forEach((chip) => chip.classList.remove("active"));
    dayError.classList.add("hidden");
  }

  // 수정용 폼 채우기 및 열기
  function openEditForm(reminder) {
    resetForm();
    formTitle.textContent = "알림 일정 수정";
    
    editId.value = reminder.id;
    alarmName.value = reminder.title;
    alarmMessage.value = reminder.message;
    alarmUrl.value = reminder.url;
    alarmTime.value = reminder.time;
    activeDays = [...reminder.days];

    // 요일 칩 활성화 상태 적용
    dayChips.forEach((chip) => {
      const dayVal = parseInt(chip.dataset.day, 10);
      if (activeDays.includes(dayVal)) {
        chip.classList.add("active");
      }
    });

    formContainer.classList.remove("hidden");
    alarmName.focus();
    formContainer.scrollIntoView({ behavior: "smooth" });
  }

  // 폼 제출 이벤트 (추가 및 수정)
  alarmForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // 요일이 최소 하나 이상 선택되었는지 확인
    if (activeDays.length === 0) {
      dayError.classList.remove("hidden");
      return;
    }
    dayError.classList.add("hidden");

    const id = editId.value;
    const title = alarmName.value.trim();
    const message = alarmMessage.value.trim();
    const url = alarmUrl.value.trim();
    const time = alarmTime.value;

    chrome.storage.local.get(["reminders"], (result) => {
      let reminders = result.reminders || [];

      if (id) {
        // 기존 알람 수정
        reminders = reminders.map((r) => {
          if (r.id === id) {
            return { ...r, title, message, url, time, days: activeDays };
          }
          return r;
        });
      } else {
        // 새 알람 추가
        const newReminder = {
          id: "reminder_" + Date.now(),
          title,
          message,
          url,
          time,
          days: activeDays,
          enabled: true
        };
        reminders.push(newReminder);
      }

      chrome.storage.local.set({ reminders }, () => {
        chrome.runtime.sendMessage({ type: "sync_alarms" }, (res) => {
          console.log("Alarms sync complete:", res);
          loadAndRenderReminders();
          formContainer.classList.add("hidden");
          resetForm();
        });
      });
    });
  });

  // 알람 활성화/비활성화 상태 업데이트
  function updateReminderEnabled(id, enabled) {
    chrome.storage.local.get(["reminders"], (result) => {
      let reminders = result.reminders || [];
      reminders = reminders.map((r) => {
        if (r.id === id) {
          return { ...r, enabled };
        }
        return r;
      });

      chrome.storage.local.set({ reminders }, () => {
        chrome.runtime.sendMessage({ type: "sync_alarms" });
      });
    });
  }

  // 알람 삭제 함수
  function deleteReminder(id) {
    chrome.storage.local.get(["reminders"], (result) => {
      let reminders = result.reminders || [];
      reminders = reminders.filter((r) => r.id !== id);

      chrome.storage.local.set({ reminders }, () => {
        chrome.runtime.sendMessage({ type: "sync_alarms" }, () => {
          loadAndRenderReminders();
        });
      });
    });
  }

  // 요일 텍스트 포맷팅 유틸
  function formatDaysText(daysArray) {
    if (daysArray.length === 7) return "매일";
    
    // 평일 판별 (토/일 제외한 월화수목금 모두 포함)
    const hasWeekdays = [1, 2, 3, 4, 5].every((d) => daysArray.includes(d));
    const hasNoWeekends = !daysArray.includes(0) && !daysArray.includes(6);
    if (daysArray.length === 5 && hasWeekdays && hasNoWeekends) return "평일";

    // 주말 판별 (토/일만 포함)
    if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return "주말";

    // 요일 가나다 정렬 후 매핑 (월=1, 화=2 ... 토=6, 일=0)
    // 보기 좋게 월~일 순서대로 출력하기 위해 정렬 가중치 생성
    const sorted = [...daysArray].sort((a, b) => {
      const getWeight = (val) => (val === 0 ? 7 : val); // 일을 맨 뒤로
      return getWeight(a) - getWeight(b);
    });

    return sorted.map((d) => DAY_NAMES[d]).join(", ");
  }

  // HTML 이스케이프 유틸
  function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 앱 로드시 데이터 렌더링
  loadAndRenderReminders();
});
