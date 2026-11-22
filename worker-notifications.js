
(function () {
    "use strict";

    // =====================================================
    // SMARTBIN — ИНТЕРФЕЙС УВЕДОМЛЕНИЙ + ONESIGNAL
    // =====================================================

    const TABLE_ID = "1335863";
    const CHECK_INTERVAL = 30000;

    const READ_STORAGE_KEY =
        "smartbin_worker_read_notifications_v1";

    const SEEN_STORAGE_KEY =
        "smartbin_worker_seen_notifications_v1";

    let notifications = [];
    let readIds = new Set();
    let seenIds = new Set();

    let loading = false;
    let initialized = false;
    let oneSignalInstance = null;


    // =====================================================
    // ПОДКЛЮЧЕНИЕ ONESIGNAL
    // =====================================================

    window.OneSignalDeferred =
        window.OneSignalDeferred || [];

    OneSignalDeferred.push(function (OneSignal) {

        oneSignalInstance = OneSignal;

        updatePermissionButton();

        console.log("SmartBin: OneSignal готов.");

    });


    // =====================================================
    // ЛОКАЛЬНОЕ ХРАНИЛИЩЕ
    // =====================================================

    function loadStoredIds(key) {

        try {

            const saved =
                JSON.parse(localStorage.getItem(key) || "[]");

            return new Set(
                Array.isArray(saved)
                    ? saved.map(String)
                    : []
            );

        } catch (error) {

            console.error("Ошибка чтения localStorage:", error);

            return new Set();
        }
    }


    function saveStoredIds(key, ids) {

        localStorage.setItem(
            key,
            JSON.stringify([...ids])
        );
    }


    function loadReadIds() {
        readIds = loadStoredIds(READ_STORAGE_KEY);
    }


    function loadSeenIds() {
        seenIds = loadStoredIds(SEEN_STORAGE_KEY);
    }


    // =====================================================
    // ПОДПИСКА НА ONESIGNAL
    // =====================================================

    async function enableBrowserNotifications() {

        const button = document.getElementById(
            "enableBrowserNotifications"
        );

        if (!oneSignalInstance) {

            alert(
                "OneSignal ещё загружается. Подожди несколько секунд и попробуй снова."
            );

            return;
        }

        try {

            button.disabled = true;
            button.textContent = "⏳ Подключение...";

            const OneSignal = oneSignalInstance;

            // Проверяем поддержку Web Push
            const supported =
                OneSignal.Notifications.isPushSupported();

            if (!supported) {

                alert(
                    "Этот браузер или режим работы устройства не поддерживает Web Push."
                );

                return;
            }

            // Проверяем разрешение браузера
            if (!OneSignal.Notifications.permission) {

                await OneSignal.Notifications.requestPermission();
            }

            // Если пользователь разрешил уведомления,
            // регистрируем подписку
            if (OneSignal.Notifications.permission) {

                await OneSignal.User.PushSubscription.optIn();

                updatePermissionButton();

                if (OneSignal.User.PushSubscription.optedIn) {

                    alert(
                        "✅ Push-уведомления SmartBin включены!"
                    );

                    console.log(
                        "OneSignal ID:",
                        OneSignal.User.onesignalId
                    );

                    console.log(
                        "Subscription ID:",
                        OneSignal.User.PushSubscription.id
                    );

                } else {

                    alert(
                        "Разрешение получено, но подписка ещё не завершена. Подожди немного и проверь снова."
                    );
                }

            } else {

                alert(
                    "Разрешение на уведомления не получено. Проверь настройки браузера."
                );
            }

        } catch (error) {

            console.error(
                "Ошибка подписки OneSignal:",
                error
            );

            alert(
                "Не удалось включить Push-уведомления. Подробности смотри в консоли браузера."
            );

        } finally {

            if (button) {
                button.disabled = false;
                updatePermissionButton();
            }
        }
    }


    // =====================================================
    // ОБНОВЛЕНИЕ КНОПКИ ONESIGNAL
    // =====================================================

    function updatePermissionButton() {

        const button = document.getElementById(
            "enableBrowserNotifications"
        );

        if (!button) return;

        if (!oneSignalInstance) {

            button.textContent =
                "⏳ Загрузка OneSignal...";

            return;
        }

        const OneSignal = oneSignalInstance;

        if (!OneSignal.Notifications.isPushSupported()) {

            button.textContent =
                "⚠️ Push не поддерживается";

            button.disabled = true;

            return;
        }

        button.disabled = false;

        if (OneSignal.User.PushSubscription.optedIn) {

            button.textContent =
                "✅ Push-уведомления включены";

        } else if (!OneSignal.Notifications.permission) {

            button.textContent =
                "🔔 Включить Push-уведомления";

        } else {

            button.textContent =
                "🔔 Подписаться на Push-уведомления";
        }
    }


    // =====================================================
    // BASEROW — ПОЛУЧЕНИЕ УВЕДОМЛЕНИЙ
    // =====================================================

    async function fetchNotifications() {

        let allResults = [];
        let page = 1;
        let hasNext = true;

        while (hasNext && page <= 10) {

            const data = await baserowRequest(
                TABLE_ID,
                `?user_field_names=true&size=200&page=${page}`
            );

            const results = data.results || [];

            allResults = allResults.concat(results);

            hasNext = Boolean(data.next);

            page++;
        }

        return allResults;
    }


    // =====================================================
    // ДАННЫЕ УВЕДОМЛЕНИЯ
    // =====================================================

    function getNotificationId(item) {
        return String(item.id);
    }


    function getNotificationTitle(item) {

        return item["Заголовок"] ||
            "Уведомление SmartBin";
    }


    function getNotificationMessage(item) {

        return (
            item["Сообщение"] ??
            item["Сообщения"] ??
            "Нет описания уведомления."
        );
    }


    function getNotificationType(item) {
        return item["Тип"] || "Общее";
    }


    function getNotificationDate(item) {
        return item["Дата"] || null;
    }


    function getFormattedDate(value) {

        if (!value) return "Дата не указана";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Дата не указана";
        }

        return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    // =====================================================
    // ОБНАРУЖЕНИЕ НОВЫХ УВЕДОМЛЕНИЙ
    // =====================================================

    function detectNewNotifications(items) {

        items.forEach(function (item) {

            const id = getNotificationId(item);

            if (!seenIds.has(id)) {

                seenIds.add(id);
            }

        });

        saveStoredIds(
            SEEN_STORAGE_KEY,
            seenIds
        );
    }


    // =====================================================
    // СЧЁТЧИК НЕПРОЧИТАННЫХ
    // =====================================================

    function updateUnreadCount() {

        const counter = document.getElementById(
            "notificationCount"
        );

        if (!counter) return;

        const unreadCount =
            notifications.filter(function (item) {

                return !readIds.has(
                    getNotificationId(item)
                );

            }).length;

        counter.textContent =
            unreadCount > 99 ? "99+" : unreadCount;

        counter.style.display =
            unreadCount > 0 ? "flex" : "none";
    }


    // =====================================================
    // СОЗДАНИЕ ЭЛЕМЕНТА УВЕДОМЛЕНИЯ
    // =====================================================

    function createNotificationElement(item) {

        const id = getNotificationId(item);
        const title = getNotificationTitle(item);
        const message = getNotificationMessage(item);
        const type = getNotificationType(item);

        const date = getFormattedDate(
            getNotificationDate(item)
        );

        const isUnread = !readIds.has(id);

        const element =
            document.createElement("div");

        element.className =
            "notification-item" +
            (isUnread ? " unread" : "");

        element.dataset.type = type;

        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");

        const titleContainer =
            document.createElement("div");

        titleContainer.className =
            "notification-item-title";

        const heading =
            document.createElement("h4");

        heading.textContent = title;

        titleContainer.appendChild(heading);

        if (isUnread) {

            const badge =
                document.createElement("span");

            badge.className =
                "notification-unread-label";

            badge.textContent = "НОВОЕ";

            titleContainer.appendChild(badge);
        }

        const paragraph =
            document.createElement("p");

        paragraph.textContent = message;

        const dateElement =
            document.createElement("small");

        dateElement.textContent = date;

        element.appendChild(titleContainer);
        element.appendChild(paragraph);
        element.appendChild(dateElement);

        function markThisRead() {

            if (readIds.has(id)) return;

            readIds.add(id);

            saveStoredIds(
                READ_STORAGE_KEY,
                readIds
            );

            renderNotifications();
        }

        element.addEventListener(
            "click",
            markThisRead
        );

        element.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    markThisRead();
                }
            }
        );

        return element;
    }


    // =====================================================
    // ОТОБРАЖЕНИЕ УВЕДОМЛЕНИЙ
    // =====================================================

    function renderNotifications() {

        const container = document.getElementById(
            "notificationList"
        );

        if (!container) return;

        container.innerHTML = "";

        if (notifications.length === 0) {

            const empty =
                document.createElement("p");

            empty.className =
                "notifications-empty";

            empty.textContent =
                "🎉 Пока нет уведомлений.";

            container.appendChild(empty);

            updateUnreadCount();

            return;
        }

        notifications.forEach(function (item) {

            container.appendChild(
                createNotificationElement(item)
            );

        });

        updateUnreadCount();
    }


    // =====================================================
    // ЗАГРУЗКА И ОБНОВЛЕНИЕ СПИСКА
    // =====================================================

    async function loadWorkerNotifications() {

        if (loading) return;

        if (typeof baserowRequest !== "function") {

            console.error(
                "SmartBin: baserowRequest не найдена."
            );

            return;
        }

        loading = true;

        try {

            const items = await fetchNotifications();

            items.sort(function (a, b) {

                const dateA = new Date(
                    getNotificationDate(a) || 0
                ).getTime();

                const dateB = new Date(
                    getNotificationDate(b) || 0
                ).getTime();

                return dateB - dateA;
            });

            detectNewNotifications(items);

            notifications = items;

            renderNotifications();

            initialized = true;

        } catch (error) {

            console.error(
                "Ошибка загрузки уведомлений:",
                error
            );

            const container =
                document.getElementById("notificationList");

            if (container && notifications.length === 0) {

                container.innerHTML = `
                    <p class="notifications-empty">
                        ❌ Не удалось загрузить уведомления.
                        <br><br>
                        Проверь подключение к Baserow.
                    </p>
                `;
            }

        } finally {

            loading = false;
        }
    }


    // =====================================================
    // ПРОЧИТАТЬ ВСЕ
    // =====================================================

    function markAllNotificationsRead() {

        notifications.forEach(function (item) {

            readIds.add(
                getNotificationId(item)
            );

        });

        saveStoredIds(
            READ_STORAGE_KEY,
            readIds
        );

        renderNotifications();
    }


    // =====================================================
    // ОТКРЫТИЕ И ЗАКРЫТИЕ ПАНЕЛИ
    // =====================================================

    function openNotificationPanel() {

        const panel = document.getElementById(
            "notificationPanel"
        );

        const bell = document.getElementById(
            "notificationBell"
        );

        if (!panel || !bell) return;

        panel.classList.add("show");

        bell.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function closeNotificationPanel() {

        const panel = document.getElementById(
            "notificationPanel"
        );

        const bell = document.getElementById(
            "notificationBell"
        );

        if (!panel || !bell) return;

        panel.classList.remove("show");

        bell.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function toggleNotificationPanel() {

        const panel = document.getElementById(
            "notificationPanel"
        );

        if (!panel) return;

        if (panel.classList.contains("show")) {

            closeNotificationPanel();

        } else {

            openNotificationPanel();

            loadWorkerNotifications();
        }
    }


    // =====================================================
    // ПОДКЛЮЧЕНИЕ СОБЫТИЙ
    // =====================================================

    function connectNotificationInterface() {

        const bell = document.getElementById(
            "notificationBell"
        );

        const markAllButton =
            document.getElementById(
                "markAllNotificationsRead"
            );

        const permissionButton =
            document.getElementById(
                "enableBrowserNotifications"
            );

        if (bell) {

            bell.addEventListener(
                "click",
                toggleNotificationPanel
            );
        }

        if (markAllButton) {

            markAllButton.addEventListener(
                "click",
                markAllNotificationsRead
            );
        }

        if (permissionButton) {

            permissionButton.addEventListener(
                "click",
                enableBrowserNotifications
            );
        }

        document.addEventListener(
            "click",
            function (event) {

                const wrapper =
                    document.querySelector(
                        ".worker-notifications"
                    );

                if (
                    wrapper &&
                    !wrapper.contains(event.target)
                ) {

                    closeNotificationPanel();
                }
            }
        );

        document.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Escape") {
                    closeNotificationPanel();
                }
            }
        );
    }


    // =====================================================
    // ЗАПУСК
    // =====================================================

    function startNotifications() {

        loadReadIds();
        loadSeenIds();

        connectNotificationInterface();

        updatePermissionButton();

        loadWorkerNotifications();

        setInterval(
            loadWorkerNotifications,
            CHECK_INTERVAL
        );

        console.log(
            "SmartBin: интерфейс уведомлений запущен."
        );
    }


    // =====================================================
    // ПУБЛИЧНЫЕ ФУНКЦИИ
    // =====================================================

    window.loadWorkerNotifications =
        loadWorkerNotifications;

    window.enableWorkerBrowserNotifications =
        enableBrowserNotifications;


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            startNotifications
        );

    } else {

        startNotifications();
    }

})();
