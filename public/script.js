document.addEventListener('DOMContentLoaded', function() {
  // Firebaseが読み込まれているか確認
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
    console.error("Firebaseが正しく初期化されていません。firebase-config.jsの読み込みと設定内容を確認してください。");
    alert("アプリケーションの読み込みに失敗しました。設定を確認してください。");
    return; // Firebaseがなければ処理を中断
  }

  // Firebaseのインスタンスを初期化
  const db = firebase.firestore();

  // 1) 今日の日付を先に定義
  const today = new Date();
  const calendarEl = document.getElementById('calendar');
  let fullCalendarInstance; // 衝突を避けるため、より具体的な変数名に変更

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
  const editorNameInput     = document.getElementById('editorNameInput');
  const eventTypeInput      = document.getElementById('eventType');
  const logCloseBtn         = document.getElementById('logCloseBtn');
  const logContent          = document.getElementById('logContent');
  const deleteAllLogsBtn    = document.getElementById('deleteAllLogsBtn');

  // 日付メモモーダルの要素取得
  const dailyMemoModal = document.getElementById('dailyMemoModal');
  const dailyMemoCloseBtn = document.getElementById('dailyMemoCloseBtn');
  const dailyMemoDateEl = document.getElementById('dailyMemoDate');
  const dailyMemoTextEl = document.getElementById('dailyMemoText');
  const dailyMemoSaveBtn = document.getElementById('dailyMemoSaveBtn');
  const dailyMemoDeleteBtn = document.getElementById('dailyMemoDeleteBtn');

  let currentUser = null; // ログイン中のユーザー情報を保持
  let isAdminMode = false;
  let selectedStart, selectedEnd;
  let dailyMemos = {};
  let currentEditingDate = null;

  // カレンダー要素が存在する場合のみ初期化処理を実行
  if (calendarEl) {
    // --- FullCalendar 初期化 ---
    calendar = new FullCalendar.Calendar(calendarEl, {
      plugins: [
        FullCalendarInteraction,
        FullCalendarTimeGrid,
        FullCalendarDayGrid,
        FullCalendarList
      ],
      // 今日の曜日を左端に
      firstDay: today.getDay(),

      // ヘッダーのツールバー設定
      headerToolbar: {
        left:   'prev,next today',
        center: 'title',
        right:  'timeGridWeek,timeGridDay,listWeek'
      },
      
      // グリッド設定
      initialView: 'timeGridWeek',
      slotDuration: '00:30:00',
      slotMinTime:  '06:00:00',
      slotMaxTime:  '22:00:00',
      aspectRatio:  1.2, // スマホ表示で縦長になりすぎないように調整

      // タッチ操作
      selectable:           false, // 初期状態では選択不可とし、ログイン後に有効化する
      selectLongPressDelay: 300,
      longPressDelay:       300,
      editable:             false,

      // 日時選択時
      select: info => {
        selectedStart = info.startStr;
        selectedEnd   = info.endStr;
        modal.style.display = 'block';
        // モーダルが開いたときにフォームの状態をリセットし、
        // バリデーションを初期実行してボタンを無効化する
        bandNameInput.value = '';
        commentInput.value = '';
        editorNameInput.value = '';
        eventTypeInput.selectedIndex = 0;
        validateModalInputs();
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

            // Firestoreからイベントを削除（onSnapshotがカレンダーからの削除をハンドル）
            db.collection('events').doc(ev.id).delete().then(() => {
              addLogEntry("削除", ev, deleterName.trim()); // 削除成功後にログを記録
              alert("予約を削除しました。");
            }).catch(error => alert("削除に失敗しました: " + error));
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
          [EVENT_TYPES.PERSONAL]: {bg:'#87CEEB'},
          [EVENT_TYPES.CONFIRMED]:{bg:'#FFB6C1'},
          [EVENT_TYPES.REQUEST]:  {bg:'#CDE6C7'},
          [EVENT_TYPES.FIXED]:    {bg:'#FFF5D2'},
          [EVENT_TYPES.NO_SOUND]: {bg:'#B0B0B0'}
        };
        const cols = cmap[type];
        if (cols) {
          info.el.style.backgroundColor = cols.bg;
          info.el.style.borderColor     = cols.bg;
        }
        if (type === EVENT_TYPES.NO_SOUND) info.el.style.opacity = '0.5';
        if (comment) info.el.setAttribute('title', comment);
      },

      // カレンダーのビューが初期化・変更されたときに呼ばれる
      datesSet: function(dateInfo) {
        fetchAndDisplayDailyMemos();
      },

      // 各日付セルが描画されたときの処理
      dayCellDidMount: function(arg) {
        // このセルが終日スロットの行に属しているか確認
        // timeGridビューの終日部分はdayGridとしてレンダリングされる
        const isAllDaySlot = arg.el.closest('.fc-daygrid-body');

        if (isAllDaySlot) {
          const dateStr = arg.date.toISOString().split('T')[0];
          // .fc-daygrid-day-frame は日表示の枠
          const frame = arg.el.querySelector('.fc-daygrid-day-frame');
          if (!frame) return;

          // 既存の要素がなければ追加する
          if (!frame.querySelector('.daily-memo-container')) {
            // メモ表示用のコンテナを追加
            const memoContainer = document.createElement('div');
            memoContainer.classList.add('daily-memo-container');
            memoContainer.setAttribute('data-date', dateStr);
            frame.appendChild(memoContainer);
          }

          if (!frame.querySelector('.daily-memo-edit-icon')) {
            // 編集アイコンを追加（CSSで管理者モード時のみ表示）
            const editIcon = createMemoEditIcon(dateStr);
            frame.appendChild(editIcon);
          }
        }
      }
    });

    fullCalendarInstance.render();

    // --- Firestoreからイベントをリアルタイムで読み込み ---
    db.collection('events').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const eventData = { id: change.doc.id, ...change.doc.data() };
        const existingEvent = fullCalendarInstance.getEventById(change.doc.id);

        if (change.type === 'added') {
          if (!existingEvent) {
            fullCalendarInstance.addEvent(eventData);
          }
        }
        if (change.type === 'modified') {
          if (existingEvent) existingEvent.remove();
          fullCalendarInstance.addEvent(eventData);
        }
        if (change.type === 'removed') {
          if (existingEvent) existingEvent.remove();
        }
      });
    }, error => console.error("イベントの読み込みエラー: ", error));
  } else {
    console.error("カレンダーを描画するための要素 #calendar が見つかりません。");
  }

    // --- 埋め込みカレンダー 日付入力 & 表示 ---
  const dateInput = document.getElementById('resvDate');
  const loadBtn = document.getElementById('loadResvBtn');
  const pad = n => String(n).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const future = new Date(today.getTime() + 1000*60*60*24*60);
  dateInput.max = `${future.getFullYear()}-${pad(future.getMonth()+1)}-${pad(future.getDate())}`;
  dateInput.value = dateInput.min;

  // 静的HTML読み込みに切り替え
  async function loadIframeContent() {
    const d = dateInput.value;
    if (!d) return alert('日付を選択してください');
    const iframe = document.getElementById('resvIframe');
    const url = `/htmls/${d}.html`;

    // fetch APIで事前にファイルの存在を確認
    try {
      const response = await fetch(url);
      if (response.ok) {
        // ファイルが存在すれば、iframeのsrcに設定
        iframe.src = url;
      } else {
        // ファイルが存在しない場合は、エラーメッセージを直接iframeに書き込む
        iframe.srcdoc = `<p style="padding: 1em; text-align: center; color: #555;">${d} の予約情報は見つかりませんでした。</p>`;
      }
    } catch (error) {
      console.error("iframeの読み込みエラー:", error);
      iframe.srcdoc = `<p style="padding: 1em; text-align: center; color: #d32f2f;">予約情報の読み込み中にエラーが発生しました。</p>`;
    }
  }
  loadBtn.addEventListener('click', loadIframeContent);
  loadIframeContent(); // ページ読み込み時に実行

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
        // idはFirestoreが自動で採番するので不要
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

  // --- Firebase Authentication ---

  // 認証状態の変更を監視
  firebase.auth().onAuthStateChanged(async (user) => { // asyncを追加してawaitを使えるようにする
    currentUser = user; // ログイン状態をグローバル変数に保持
    let isAuthorizedAdmin = false; // デフォルトは非管理者

    if (user) {
      // Firestoreの'admins'コレクションにユーザーのメールアドレスのドキュメントが存在するか確認
      const adminDoc = await db.collection('admins').doc(user.email).get();
      if (adminDoc.exists) {
        isAuthorizedAdmin = true;
      }
    }
    
    isAdminMode = isAuthorizedAdmin;
    document.body.classList.toggle('admin-mode', isAdminMode);
    toggleAdminModeBtn.textContent = isAdminMode ? "ログアウト" : "管理者ログイン";

    // ログイン状態に応じてカレンダーの選択可否を動的に変更
    if (fullCalendarInstance) {
      // ログインしているユーザーのみ、カレンダーの日時選択を可能にする
      fullCalendarInstance.setOption('selectable', !!user);
    }
    updateFixedOptionVisibility();

    // もしGoogleアカウントでログインはしているが、許可リストにないユーザーだった場合
    if (user && !isAuthorizedAdmin) {
      alert(`「${user.email}」は管理者として登録されていません。自動的にログアウトします。`);
      firebase.auth().signOut(); // 強制的にログアウト
    }
  });

  // 管理者モード切替ボタンの処理をFirebase Googleログイン用に変更
  toggleAdminModeBtn.addEventListener('click', () => {
    const auth = firebase.auth();
    if (isAdminMode) {
      // ログイン中ならログアウト処理
      auth.signOut().then(() => {
        alert("ログアウトしました。");
      }).catch(error => {
        console.error("ログアウトエラー", error);
        alert("ログアウトに失敗しました。");
      });
    } else {
      // 未ログインならGoogleログイン処理
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then((result) => {
          // ログイン成功後のチェックは onAuthStateChanged が自動で行うので、
          // ここではシンプルに成功メッセージを表示するだけでも良い
          const user = result.user;
          // isAuthorizedAdmin の判定は onAuthStateChanged に任せる
          // ここで改めてチェックする必要はありません
          console.log(`ログイン試行成功: ${user.displayName} (${user.email})`);
        }).catch((error) => {
          console.error("Googleログインエラー:", error);
          alert("Googleログインに失敗しました。ポップアップがブロックされていないか確認してください。");
        });
    }
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
    const editorName = currentUser ? currentUser.displayName || currentUser.email : "管理者";
    const newEvent = {
      // idはFirestoreが自動で採番するので不要
      title: "音出し禁止",
      start: start,
      end: end,
      allDay: false,
      extendedProps: {
        type: EVENT_TYPES.NO_SOUND,
        comment: "",
        editor: editorName
      }
    };
    addEventToStorageAndCalendar(newEvent);
    adminModal.style.display = 'none';
  });

  // --- 予約ルール検証 ---
  function validateReservation(calendarInstance, eventData) {
    const { type, title, start, now, editor } = eventData; // editor を受け取る

    if (type === EVENT_TYPES.FIXED && !isAdminMode) {
      return "固定枠は管理者モードでのみ予約できます。";
    }

    if (type === EVENT_TYPES.CONFIRMED) {
      if (!calendarInstance || typeof calendarInstance.getEvents !== 'function') {
        console.error("Error: FullCalendar instance not available for validation.");
        return "カレンダーの初期化が完了していません。しばらく待ってから再度お試しください。";
      }
      if ((start - now) / (1000 * 60 * 60 * 24) > 7) {
        return "確定枠は1週間先までしか予約できません。";
      }
      // チェックロジックを「バンド名」から「記入者名」に変更し、どの予約が原因か特定する
      const existingEvent = calendarInstance.getEvents().find(e =>
        e.extendedProps.type === EVENT_TYPES.CONFIRMED &&
        e.extendedProps.editor === editor &&
        new Date(e.end) > now
      );
      if (existingEvent) {
        return `あなたはすでに確定枠の予約（バンド名: ${existingEvent.title}）を保持しているため、新たな予約はできません。\nその予約が終了してから再度お試しください。`;
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

  // --- 予約モーダルの入力バリデーション ---
  function validateModalInputs() {
    const title = bandNameInput.value.trim();
    const editor = editorNameInput.value.trim();
    // バンド名と記入者名が両方入力されている場合のみ保存ボタンを有効化
    saveBtn.disabled = !title || !editor;
  }

  // 予約モーダル内の入力フィールドに変更があるたびにバリデーションを実行
  bandNameInput.addEventListener('input', validateModalInputs);
  editorNameInput.addEventListener('input', validateModalInputs);

  closeBtn.addEventListener('click', () => modal.style.display = 'none');

  saveBtn.addEventListener('click', function () {
    const title = bandNameInput.value.trim();
    const comment = commentInput.value.trim();
    const editor = editorNameInput.value.trim();
    const type  = eventTypeInput.value;
    const now   = new Date();
    const start = new Date(selectedStart);
    const end   = new Date(selectedEnd);
  
    if (!title || !editor) { // このチェックは念のため残す
      alert("バンド名と記入者名は必須です。");
      return;
    }
  
    // 予約ルールの検証
    const validationError = validateReservation(fullCalendarInstance, { type, title, start, now, editor });
    if (validationError) {
      alert(validationError);
      return;
    }
  
    const newEvent = {
      // idはFirestoreが自動で採番するので不要
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
    // Firestoreにイベントを追加（onSnapshotがカレンダーへの追加をハンドルする）
    db.collection('events').add(event).then(docRef => {
      console.log("イベント追加成功: ", docRef.id);
      addLogEntry(action, { id: docRef.id, ...event }, event.extendedProps.editor);
    }).catch(error => {
      console.error("イベント追加エラー: ", error);
      alert("予約の追加に失敗しました。");
    });
  }
  
  // ログを追加（コメントも含める）
  function addLogEntry(action, eventObject, editorName) {
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
    // Firestoreにログを追加
    db.collection('logs').add(entry).catch(error => {
      console.error("ログの記録エラー: ", error);
    });
  }
  
  // ログ表示処理
  logBtn.addEventListener('click', () => {
    // Firestoreからログを取得
    db.collection('logs').orderBy('timestamp', 'desc').get().then(querySnapshot => {
      const logs = querySnapshot.docs.map(doc => doc.data());
      logContent.textContent = logs.map(log =>
        `[${log.timestamp}] ${log.action}: ${log.title} (${log.type}) ${log.start} → ${log.end}` +
        `${log.editor ? "｜記入者: " + log.editor : ""}` +
        `${log.comment ? "｜コメント: " + log.comment : ""}`
      ).join('\n') || "ログはありません。";
    }).catch(error => logContent.textContent = "ログの読み込みに失敗しました: " + error);
    // 管理者モードの場合のみ、全削除ボタンを表示
    deleteAllLogsBtn.style.display = isAdminMode ? 'block' : 'none';

    logModal.style.display = 'block';
  });
  
  logCloseBtn.addEventListener('click', () => logModal.style.display = 'none');

  // 全ログと予定を削除する処理
  deleteAllLogsBtn.addEventListener('click', () => {
    if (!isAdminMode) {
      alert('この操作は管理者のみ可能です。');
      return;
    }
    if (confirm('本当に全てのログと予定が削除されますがよろしいですか？\nこの操作は元に戻せません。')) {
      // Firestoreの全ログと予定を削除（バッチ処理）
      const deleteCollection = async (collectionPath) => {
        const collectionRef = db.collection(collectionPath);
        const querySnapshot = await collectionRef.get();
        const batch = db.batch();
        querySnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        return batch.commit();
      };

      Promise.all([deleteCollection('events'), deleteCollection('logs'), deleteCollection('dailyMemos')])
        .then(() => {
          alert('全てのログと予定、メモを削除しました。');
          logContent.textContent = "ログはありません。";
          logModal.style.display = 'none';
        }).catch(error => alert("削除中にエラーが発生しました: " + error));
    }
  });

  // --- 日付メモ機能 ---

  /**
   * メモ編集用のアイコン(📝)を生成します。
   * @param {string} dateStr - 対象の日付 (YYYY-MM-DD)
   * @returns {HTMLElement} 生成された<span>要素
   */
  function createMemoEditIcon(dateStr) {
    const editIcon = document.createElement('span');
    editIcon.innerHTML = '📝';
    editIcon.classList.add('daily-memo-edit-icon');
    editIcon.title = 'この日のメモを編集';
    editIcon.onclick = (e) => {
      e.stopPropagation(); // 親要素へのイベント伝播を停止
      openDailyMemoModal(dateStr);
    };
    return editIcon;
  }

  /**
   * localStorageから日次メモを読み込み、カレンダーの終日スロットに表示します。
   */
  function fetchAndDisplayDailyMemos() {
    // Firestoreからメモをリアルタイムで取得
    db.collection('dailyMemos').onSnapshot(snapshot => {
      dailyMemos = {};
      snapshot.forEach(doc => {
        dailyMemos[doc.id] = doc.data().text;
      });
      document.querySelectorAll('.daily-memo-container').forEach(container => {
        const dateStr = container.getAttribute('data-date');
        container.textContent = dailyMemos[dateStr] || '';
        container.style.display = dailyMemos[dateStr] ? 'block' : 'none';
      });
    }, error => console.error("日次メモの読み込みエラー: ", error));
  }
  // アプリケーション開始時にメモを読み込む
  fetchAndDisplayDailyMemos();
  function openDailyMemoModal(dateStr) {
    currentEditingDate = dateStr;
    dailyMemoDateEl.innerText = `${dateStr} のメモ`;
    dailyMemoTextEl.value = dailyMemos[dateStr] || '';
    dailyMemoModal.style.display = 'block';
  }

  // メモ編集モーダルの閉じるボタン
  dailyMemoCloseBtn.onclick = () => {
    dailyMemoModal.style.display = 'none';
  };

  // メモを保存するボタン
  dailyMemoSaveBtn.onclick = () => {
    if (!currentEditingDate) return;
    const memoText = dailyMemoTextEl.value.trim();

    if (!memoText) {
      deleteDailyMemo(); // メモが空なら削除として扱う
      return;
    }

    // Firestoreにメモを保存（ドキュメントIDを日付にする）
    db.collection('dailyMemos').doc(currentEditingDate).set({ text: memoText })
      .then(() => {
        addLogEntry("メモ更新", { title: `[${currentEditingDate}] ${memoText}` }, "管理者");
        dailyMemoModal.style.display = 'none';
      }).catch(error => {
        alert("メモの保存に失敗しました: " + error);
      });
  };

  // メモを削除するボタン
  dailyMemoDeleteBtn.onclick = () => {
    if (!currentEditingDate) return;
    if (confirm(`${currentEditingDate} のメモを本当に削除しますか？`)) {
      deleteDailyMemo();
    }
  };

  function deleteDailyMemo() {
    if (!currentEditingDate) return;
    // Firestoreからメモを削除
    db.collection('dailyMemos').doc(currentEditingDate).delete()
      .then(() => {
        addLogEntry("メモ削除", { title: `[${currentEditingDate}]` }, "管理者");
        dailyMemoModal.style.display = 'none';
      }).catch(error => {
        alert("メモの削除に失敗しました: " + error);
      });
  }

  // モーダル外クリックで閉じる処理
  window.onclick = function(event) {
    if (event.target == modal) modal.style.display = "none";
    if (event.target == adminModal) adminModal.style.display = "none";
    if (event.target == logModal) logModal.style.display = "none";
    if (event.target == fixedSlotModal) fixedSlotModal.style.display = "none";
    if (event.target == eventDetailModal) eventDetailModal.style.display = "none";
    if (event.target == dailyMemoModal) dailyMemoModal.style.display = "none";
  }
});