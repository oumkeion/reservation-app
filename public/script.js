document.addEventListener('DOMContentLoaded', function () {
  // 1) 今日の日付を先に定義
  const today = new Date();

  // 時刻フォーマットヘルパー
  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // 定数定義
  const EVENT_TYPES = {
    PERSONAL: 'personal',
    CONFIRMED: 'confirmed',
    REQUEST: 'request',
    FIXED: 'fixed',
    NO_SOUND: 'no-sound',
  };

  // モーダル / ボタン要素の取得
  const eventDetailModal    = document.getElementById('eventDetailModal');
  const eventDetailCloseBtn = document.getElementById('eventDetailCloseBtn');
  const detailTitle         = document.getElementById('detailTitle');
  const detailTime          = document.getElementById('detailTime');
  const detailComment       = document.getElementById('detailComment');
  const detailEditor        = document.getElementById('detailEditor');
  const deleteEventBtn      = document.getElementById('deleteEventBtn');
  const calendarEl          = document.getElementById('calendar');
  const modal               = document.getElementById('modal');
  const adminModal          = document.getElementById('adminModal');
  const logModal            = document.getElementById('logModal');
  const adminBtn            = document.getElementById('adminBtn');
  const toggleAdminModeBtn  = document.getElementById('toggleAdminMode');
  const logBtn              = document.getElementById('logBtn');
  const adminCloseBtn       = document.getElementById('adminCloseBtn');
  const adminSaveBtn        = document.getElementById('adminSaveBtn');
  const adminStartInput     = document.getElementById('adminStart');
  const adminEndInput       = document.getElementById('adminEnd');
  const closeBtn            = document.getElementById('closeBtn');
  const saveBtn             = document.getElementById('saveBtn');
  const bandNameInput       = document.getElementById('bandName');
  const commentInput        = document.getElementById('commentInput');
  const eventTypeInput      = document.getElementById('eventType');
  const logCloseBtn         = document.getElementById('logCloseBtn');
  const logContent          = document.getElementById('logContent');

  let isAdminMode = false;
  let selectedStart, selectedEnd;

  // --- FullCalendar 初期化 ---
  const calendar = new FullCalendar.Calendar(calendarEl, {
    // 今日の曜日を左端に
    firstDay: today.getDay(),

    // ヘッダーは非表示、左右スワイプだけで次週/前週を表示
    headerToolbar: {
      left: '',
      center: 'title',
      right: ''
    },

    // １週間分だけ表示
    visibleRange: {
      start: today.toISOString().slice(0,10),
      end:   new Date(
               today.getFullYear(),
               today.getMonth(),
               today.getDate() + 7
             ).toISOString().slice(0,10)
    },

    // グリッド設定
    initialView: 'timeGridWeek',
    slotDuration: '00:30:00',
    slotMinTime:  '06:00:00',
    slotMaxTime:  '22:00:00',
    height:       'auto',

    // タッチ操作
    selectable:           true,
    selectLongPressDelay: 300,
    longPressDelay:       300,
    editable:             false,

    // 日時選択時
    select: info => {
      selectedStart = info.startStr;
      selectedEnd   = info.endStr;
      modal.style.display = 'block';
    },

    // 既存イベントクリック時
    eventClick: info => {
      const ev       = info.event;
      const type     = ev.extendedProps.type;
      const isProt   = (type === EVENT_TYPES.NO_SOUND || type === EVENT_TYPES.FIXED);
      const canDel   = isAdminMode || !isProt;

      detailTitle.textContent   = `バンド名：${ev.title}`;
      detailTime.textContent    = `時間：${formatTime(ev.start)} ～ ${formatTime(ev.end)}`;
      detailComment.textContent = `コメント：${ev.extendedProps.comment || '（なし）'}`;
      detailEditor.textContent  = `記入者：${ev.extendedProps.editor || '（不明）'}`;

      // 削除ボタンの制御
      if (canDel) {
        deleteEventBtn.style.display = 'inline-block';
        deleteEventBtn.onclick = () => {
          const deleterName = prompt('削除を実行するあなたの名前を入力してください:');
          if (!deleterName || deleterName.trim() === '') {
            return alert('削除者名の入力は必須です。');
          }
          if (!confirm(`「${ev.title}」の予約を本当に削除しますか？`)) return;

          addLogEntry("削除", ev, deleterName.trim()); // ログを先に記録
          ev.remove();
          let evs = JSON.parse(localStorage.getItem('events') || '[]');
          evs = evs.filter(e => e.id !== ev.id); // IDでイベントを特定して削除
          localStorage.setItem('events', JSON.stringify(evs));
          eventDetailModal.style.display = 'none';
        };
      } else {
        deleteEventBtn.style.display = 'none';
      }
      eventDetailModal.style.display = 'block';
    },

    // 描画後スタイル調整
    eventDidMount: info => {
      const type    = info.event.extendedProps.type;
      const comment = info.event.extendedProps.comment || '';
      const cmap    = {
        [EVENT_TYPES.PERSONAL]: {bg:'#87CEEB',fg:'#000'},
        [EVENT_TYPES.CONFIRMED]:{bg:'#FFB6C1',fg:'#000'},
        [EVENT_TYPES.REQUEST]:  {bg:'#CDE6C7',fg:'#000'},
        [EVENT_TYPES.FIXED]:    {bg:'#FFF5D2',fg:'#000'},
        [EVENT_TYPES.NO_SOUND]: {bg:'#B0B0B0',fg:'#000'}
      };
      const cols = cmap[type];
      if (cols) {
        info.el.style.backgroundColor = cols.bg;
        info.el.style.borderColor     = cols.bg;
        info.el.style.setProperty('color', cols.fg, 'important');
      }
      if (type === EVENT_TYPES.NO_SOUND) info.el.style.opacity = '0.5';
      if (comment) info.el.setAttribute('title', comment);
    },

    // ローカルストレージ読み込み
    events: JSON.parse(localStorage.getItem('events')||'[]'),
  });

  calendar.render();

    // --- 埋め込みカレンダー 日付入力 & 表示 ---
  const dateInput = document.getElementById('resvDate');
  const loadBtn = document.getElementById('loadResvBtn');
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

  fixedSlotSaveBtn.addEventListener('click', function () {
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

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== weekday) continue;

      // タイムゾーンの問題を避けるため、年月日を個別に取得して日付文字列を生成
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const start = new Date(`${dateString}T${startTime}`);
      const end = new Date(`${dateString}T${endTime}`);

      const newEvent = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // ユニークIDを追加
        title: bandName,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        extendedProps: {
          type: EVENT_TYPES.FIXED,
          comment: ""
        }
      };
      addEventToStorageAndCalendar(newEvent, "固定枠追加");
    }
    fixedSlotModal.style.display = 'none';
  });

  function updateFixedOptionVisibility() {
    const fixedOption = eventTypeInput.querySelector('option[value="fixed"]');
    if (fixedOption) {
      fixedOption.style.display = isAdminMode ? 'block' : 'none';
    }
  }

  toggleAdminModeBtn.addEventListener('click', function () {
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
  });

  adminBtn.addEventListener('click', function () {
    if (!isAdminMode) {
      alert("管理者モードでのみ使用可能です。");
      return;
    }
    adminModal.style.display = 'block';
  });

  adminCloseBtn.addEventListener('click', () => adminModal.style.display = 'none');

  eventDetailCloseBtn.addEventListener('click', () => eventDetailModal.style.display = 'none');


  adminSaveBtn.addEventListener('click', function () {
    const start = new Date(adminStartInput.value).toISOString();
    const end = new Date(adminEndInput.value).toISOString();
    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // ユニークIDを追加
      title: "音出し禁止",
      start: start,
      end: end,
      allDay: false,
      extendedProps: {
        type: EVENT_TYPES.NO_SOUND,
        comment: ""
      }
    };
    addEventToStorageAndCalendar(newEvent);
    adminModal.style.display = 'none';
  });

  // --- 予約ルール検証 ---
  function validateReservation(eventData) {
    const { type, title, start, now } = eventData;

    if (type === EVENT_TYPES.FIXED && !isAdminMode) {
      return "固定枠は管理者モードでのみ予約できます。";
    }

    if (type === EVENT_TYPES.CONFIRMED) {
      if ((start - now) / (1000 * 60 * 60 * 24) > 7) {
        return "確定枠は1週間先までしか予約できません。";
      }
      const hasUnfinishedConfirmed = calendar.getEvents().some(e =>
        e.extendedProps.type === EVENT_TYPES.CONFIRMED &&
        e.title === title &&
        new Date(e.end) > now
      );
      if (hasUnfinishedConfirmed) {
        return "すでに予約中の確定枠が終了していないため、新たな予約はできません。";
      }
    }

    if (type === EVENT_TYPES.REQUEST) {
      const oneWeekBefore = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
      const isSameDate = now.toDateString() === oneWeekBefore.toDateString();
      const isBetweenMidnightAnd9AM = now.getHours() >= 0 && now.getHours() < 9;
      if (!(isSameDate && isBetweenMidnightAnd9AM)) {
        return "希望枠は使用日の1週間前、0:00〜9:00の間のみ予約可能です。";
      }
    }

    if (type === EVENT_TYPES.PERSONAL) {
      const dayBefore = new Date(start);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(19, 0, 0, 0);
      if (now < dayBefore) {
        return "個人練習枠は利用日前日の19:00以降に予約できます。";
      }
    }
    return null; // 問題なし
  }

  closeBtn.addEventListener('click', () => modal.style.display = 'none');

  saveBtn.addEventListener('click', function () {
    const title = bandNameInput.value.trim();
    const comment = commentInput.value.trim();
    const editor = document.getElementById('editorNameInput').value.trim();
    const type = eventTypeInput.value;
    const now = new Date();
    const start = new Date(selectedStart);
    const end = new Date(selectedEnd);
  
    if (!title || title === "無名" || !editor) {
      alert("バンド名を入力してください");
      return;
    }
  
    // 予約ルールの検証
    const validationError = validateReservation({ type, title, start, now });
    if (validationError) {
      alert(validationError);
      return;
    }
  
    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // ユニークIDを追加
      title: title,
      start: selectedStart,
      end: selectedEnd,
      allDay: false,
      extendedProps: {
        type: type,
        comment: comment,
        editor: editor
      }
    };
  
    addEventToStorageAndCalendar(newEvent);
    modal.style.display = 'none';
  });
  
  // --- ヘルパー関数 ---

  // イベントをストレージとカレンダーに追加する共通関数
  function addEventToStorageAndCalendar(event, action = "予約追加") {
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    events.push(event);
    localStorage.setItem('events', JSON.stringify(events));
    calendar.addEvent(event);
    addLogEntry(action, event, event.extendedProps.editor);
  }
  
  // ログを追加（コメントも含める）
  function addLogEntry(action, eventObject, editorName) {
    const logs = JSON.parse(localStorage.getItem('logs') || '[]');
    const entry = {
      timestamp: new Date().toLocaleString(),
      action,
      title: eventObject.title,
      start: eventObject.startStr || eventObject.start, // FullCalendarオブジェクトと自作オブジェクトの両方に対応
      end: eventObject.endStr || eventObject.end,
      type: eventObject.extendedProps?.type || "N/A",
      comment: eventObject.extendedProps?.comment || "",
      editor: editorName || "" // ログには実行者名を記録
    };
    logs.push(entry);
    localStorage.setItem('logs', JSON.stringify(logs));
  }
  
  // ログ表示処理
  logBtn.addEventListener('click', () => {
    const logs = JSON.parse(localStorage.getItem('logs') || '[]');
    logContent.textContent = logs.map(log =>
      `[${log.timestamp}] ${log.action}: ${log.title} (${log.type}) ${log.start} → ${log.end}` +
      `${log.editor ? "｜記入者: " + log.editor : ""}` +
      `${log.comment ? "｜コメント: " + log.comment : ""}`
    ).join('\n') || "ログはありません。";
    logModal.style.display = 'block';
  });
  
  logCloseBtn.addEventListener('click', () => logModal.style.display = 'none');
});
