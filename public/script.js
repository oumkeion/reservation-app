document.addEventListener('DOMContentLoaded', function () {
  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const eventDetailModal = document.getElementById('eventDetailModal');
  const eventDetailCloseBtn = document.getElementById('eventDetailCloseBtn');
  const detailTitle = document.getElementById('detailTitle');
  const detailTime = document.getElementById('detailTime');
  const detailComment = document.getElementById('detailComment');
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('modal');
  const adminModal = document.getElementById('adminModal');
  const logModal = document.getElementById('logModal');
  const adminBtn = document.getElementById('adminBtn');
  const toggleAdminModeBtn = document.getElementById('toggleAdminMode');
  const logBtn = document.getElementById('logBtn');
  let isAdminMode = false;

  const adminCloseBtn = document.getElementById('adminCloseBtn');
  const adminSaveBtn = document.getElementById('adminSaveBtn');
  const adminStartInput = document.getElementById('adminStart');
  const adminEndInput = document.getElementById('adminEnd');

  const closeBtn = document.getElementById('closeBtn');
  const saveBtn = document.getElementById('saveBtn');
  const bandNameInput = document.getElementById('bandName');
  const commentInput = document.getElementById('commentInput');
  const eventTypeInput = document.getElementById('eventType');

  const logCloseBtn = document.getElementById('logCloseBtn');
  const logContent = document.getElementById('logContent');

  let selectedStart, selectedEnd;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    slotDuration: '00:30:00',
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    height: 'auto',
    selectable: true,
    editable: false,
    select: function (info) {
      selectedStart = info.startStr;
      selectedEnd = info.endStr;
      modal.style.display = 'block';
    },
    eventClick: function (info) {
      const event = info.event;
      const eventType = event.extendedProps.type;
    
      // 削除操作の制限だけをかけ、モーダル表示は続ける
      const isProtected = (eventType === "no-sound" || eventType === "fixed");
      const canDelete = isAdminMode || !isProtected;
    
      // 詳細モーダルに情報を表示
      detailTitle.textContent = `バンド名：${event.title}`;
      detailTime.textContent = `時間：${formatTime(event.start)} ～ ${formatTime(event.end)}`;
      detailComment.textContent = `コメント：${event.extendedProps.comment || '（なし）'}`;
      const editorText = document.getElementById('detailEditor');
      if (editorText) {
        editorText.textContent = `記入者：${event.extendedProps.editor || '（不明）'}`;
      }    

      // 削除ボタンの表示／非表示制御と処理の割り当て
      if (canDelete) {
        deleteEventBtn.style.display = "inline-block";
        deleteEventBtn.onclick = function () {
          const deleter = prompt("この予約を削除します。削除者の名前を入力してください：");
          if (!deleter) {
            alert("削除者名が必要です。");
            return;
          }
          if (confirm("この予約を削除しますか？")) {
            addLogEntry("削除（" + deleter + "）", {
              title: event.title,
              start: event.startStr,
              end: event.endStr,
              type: eventType,
              comment: event.extendedProps.comment || ""
            });
            event.remove();
            let events = JSON.parse(localStorage.getItem('events') || '[]');
            events = events.filter(e => !(e.start === event.startStr && e.title === event.title));
            localStorage.setItem('events', JSON.stringify(events));
            eventDetailModal.style.display = 'none';
          }
        };
      } else {
        deleteEventBtn.style.display = "none"; // 管理者以外は削除ボタン非表示
      }
    
      eventDetailModal.style.display = 'block';
    },
    
    eventDidMount: function(info) {
      const type = info.event.extendedProps?.type;
      const comment = info.event.extendedProps?.comment||"";
    
      const colorMap = {
        personal: { bg: "#87CEEB", fg: "#000000" },
        confirmed: { bg: "#FFB6C1", fg: "#000000" },
        request: { bg: "#CDE6C7", fg: "#000000" },
        fixed: { bg: "#FFF5D2", fg: "#000000" },
        "no-sound": { bg: "#B0B0B0", fg: "#000000" }
      };
    
      const colors = colorMap[type];
      if (colors) {
        info.el.style.backgroundColor = colors.bg;
        info.el.style.borderColor = colors.bg;
        info.el.style.setProperty("color", colors.fg, "important");
    
        const titleEl = info.el.querySelector(".fc-event-title");
        const timeEl = info.el.querySelector(".fc-event-time");
        if (titleEl) titleEl.style.setProperty("color", colors.fg, "important");
        if (timeEl) timeEl.style.setProperty("color", colors.fg, "important");
      }
    
      if (comment) {
        info.el.setAttribute("title", comment);
      }
    
      if (type === "no-sound") {
        info.el.style.opacity = "0.5";
      }
    },
    events: JSON.parse(localStorage.getItem('events') || '[]'),
  });

  calendar.render();

    // --- 埋め込みカレンダー 日付入力 & 表示 ---
  const dateInput = document.getElementById('resvDate');
  const loadBtn = document.getElementById('loadResvBtn');
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const future = new Date(today.getTime() + 1000*60*60*24*30);
  dateInput.max = `${future.getFullYear()}-${pad(future.getMonth()+1)}-${pad(future.getDate())}`;
  dateInput.value = dateInput.min;

  // 静的HTML読み込みに切り替え
  loadBtn.addEventListener('click', () => {
    const d = dateInput.value;
    if (!d) return alert('日付を選択してください');
    document.getElementById('resvIframe').src = `/htmls/${d}.html`;
  });
  loadBtn.click();
  
  // --- 固定枠モーダル & ロジック ---
  const fixedSlotModal = document.getElementById('fixedSlotModal');
  const fixedSlotCloseBtn = document.getElementById('fixedSlotCloseBtn');
  const fixedSlotSaveBtn = document.getElementById('fixedSlotSaveBtn');
  const fixedBandNameInput = document.getElementById('fixedBandName');
  const fixedWeekdaySelect = document.getElementById('fixedWeekday');
  const fixedStartTimeInput = document.getElementById('fixedStartTime');
  const fixedEndTimeInput = document.getElementById('fixedEndTime');
  const fixedStartDateInput = document.getElementById('fixedStartDate');
  const fixedEndDateInput = document.getElementById('fixedEndDate');

  const openFixedSlotModalBtn = document.createElement("button");
  openFixedSlotModalBtn.textContent = "固定枠設定";
  openFixedSlotModalBtn.onclick = () => {
    if (!isAdminMode) {
      alert("管理者モードでのみ使用可能です。");
      return;
    }
    fixedSlotModal.style.display = 'block';
  };
  document.body.insertBefore(openFixedSlotModalBtn, document.getElementById('calendar'));

  fixedSlotCloseBtn.onclick = () => fixedSlotModal.style.display = 'none';

  fixedSlotSaveBtn.onclick = function () {
    const bandName = fixedBandNameInput.value || "無名";
    const weekday = parseInt(fixedWeekdaySelect.value);
    const startTime = fixedStartTimeInput.value;
    const endTime = fixedEndTimeInput.value;
    const startDate = new Date(fixedStartDateInput.value);
    const endDate = new Date(fixedEndDateInput.value);

    if (endDate < startDate) {
      alert("終了日は開始日以降を指定してください。");
      return;
    }

    const events = JSON.parse(localStorage.getItem('events') || '[]');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== weekday) continue;

      const start = new Date(`${d.toISOString().split('T')[0]}T${startTime}`);
      const end = new Date(`${d.toISOString().split('T')[0]}T${endTime}`);

      const newEvent = {
        title: bandName,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        type: "fixed",
        extendedProps: { comment: "" }
      };

      events.push(newEvent);
      calendar.addEvent(newEvent);
      addLogEntry("固定枠追加", newEvent);
    }

    localStorage.setItem('events', JSON.stringify(events));
    fixedSlotModal.style.display = 'none';
  };

  function updateFixedOptionVisibility() {
    const fixedOption = eventTypeInput.querySelector('option[value="fixed"]');
    if (fixedOption) {
      fixedOption.style.display = isAdminMode ? 'block' : 'none';
    }
  }

  toggleAdminModeBtn.onclick = function () {
    if (!isAdminMode) {
      const pw = prompt("管理者パスワードを入力してください:");
      if (pw !== "oumkeion_2025") {
        alert("パスワードが違います。");
        return;
      }
    }
    isAdminMode = !isAdminMode;
    toggleAdminModeBtn.textContent = isAdminMode ? "管理者モード（ON）" : "管理者モードに切り替える";
    updateFixedOptionVisibility();
  };

  adminBtn.onclick = function () {
    if (!isAdminMode) {
      alert("管理者モードでのみ使用可能です。");
      return;
    }
    adminModal.style.display = 'block';
  };

  adminCloseBtn.onclick = () => adminModal.style.display = 'none';

  eventDetailCloseBtn.onclick = () => eventDetailModal.style.display = 'none';


  adminSaveBtn.onclick = function () {
    const start = new Date(adminStartInput.value).toISOString();
    const end = new Date(adminEndInput.value).toISOString();
    const newEvent = {
      title: "音出し禁止",
      start: start,
      end: end,
      allDay: false,
      type: "no-sound",
      extendedProps: { comment: "" }
    };
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    events.push(newEvent);
    localStorage.setItem('events', JSON.stringify(events));
    calendar.addEvent(newEvent);
    addLogEntry("追加", newEvent);
    adminModal.style.display = 'none';
  };

  closeBtn.onclick = () => modal.style.display = 'none';

  saveBtn.onclick = function () {
    const title = bandNameInput.value.trim();
    const comment = commentInput.value.trim();
    const editor = document.getElementById('editorNameInput').value.trim();
    const type = eventTypeInput.value;
    const now = new Date();
    const start = new Date(selectedStart);
    const end = new Date(selectedEnd);
  
    if (!title || title === "無名") {
      alert("バンド名を入力してください");
      return;
    }
  
    if (type === "fixed" && !isAdminMode) {
      alert("固定枠は管理者モードでのみ予約できます。");
      return;
    }
  
    if (type === "confirmed") {
      if ((start - now) / (1000 * 60 * 60 * 24) > 7) {
        alert("確定枠は1週間先までしか予約できません。");
        return;
      }
      const hasUnfinishedConfirmed = calendar.getEvents().some(e =>
        e.extendedProps.type === "confirmed" &&
        e.title === title &&
        new Date(e.end) > now
      );
      if (hasUnfinishedConfirmed) {
        alert("すでに予約中の確定枠が終了していないため、新たな予約はできません。");
        return;
      }
    }
  
    if (type === "request") {
      const oneWeekBefore = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
      const isSameDate = now.toDateString() === oneWeekBefore.toDateString();
      const isBetweenMidnightAnd9AM = now.getHours() >= 0 && now.getHours() < 9;
      if (!(isSameDate && isBetweenMidnightAnd9AM)) {
        alert("希望枠は使用日の1週間前、0:00〜9:00の間のみ予約可能です。");
        return;
      }
    }
  
    if (type === "personal") {
      const dayBefore = new Date(start);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(19, 0, 0, 0);
      if (now < dayBefore) {
        alert("個人練習枠は利用日前日の19:00以降に予約できます。");
        return;
      }
    }
  
    const newEvent = {
      title: title,
      start: selectedStart,
      end: selectedEnd,
      allDay: false,
      type: type,
      extendedProps: {
        comment: comment,
        editor: editor
      }
    };
  
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    events.push(newEvent);
    localStorage.setItem('events', JSON.stringify(events));
    calendar.addEvent(newEvent);
    addLogEntry("追加", newEvent);
    modal.style.display = 'none';
  };
  
  // ログを追加（コメントも含める）
  function addLogEntry(action, event) {
    const logs = JSON.parse(localStorage.getItem('logs') || '[]');
    const entry = {
      timestamp: new Date().toLocaleString(),
      action,
      title: event.title,
      start: event.start,
      end: event.end,
      type: event.type,
      comment: event.extendedProps?.comment || "",
      editor: event.extendedProps?.editor || ""
    };
    logs.push(entry);
    localStorage.setItem('logs', JSON.stringify(logs));
  }
  
  // ログ表示処理
  logBtn.onclick = () => {
    const logs = JSON.parse(localStorage.getItem('logs') || '[]');
    logContent.textContent = logs.map(log =>
      `[${log.timestamp}] ${log.action}: ${log.title} (${log.type}) ${log.start} → ${log.end}` +
      `${log.editor ? "｜記入者: " + log.editor : ""}` +
      `${log.comment ? "｜コメント: " + log.comment : ""}`
    ).join('\n') || "ログはありません。";
    logModal.style.display = 'block';
  };  
  
  logCloseBtn.onclick = () => logModal.style.display = 'none';
});


