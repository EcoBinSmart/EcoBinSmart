
(function () {
    "use strict";

    // =====================================================
    // SMARTBIN — УВЕДОМЛЕНИЯ
    // =====================================================

    const WORKER_NOTIFICATIONS_TABLE_ID = "1335863";

    const NOTIFICATIONS_CHECK_INTERVAL = 30000;

    const NOTIFICATIONS_STORAGE_KEY =
        "smartbin_notification_snapshot";

    let isCheckingNotifications = false;
    let monitoringStarted = false;

    // =====================================================
    // СОСТОЯНИЕ МУСОРОК
    // =====================================================

    function getNotificationSnapshot(previousSnapshot = {}) {
        const snapshot = {};
        const now = Date.now();

        bins.forEach(function (row) {
            const id = row.id;

            const fill = getFill(row);
            const status = getStatus(fill);

            const previous = previousSnapshot[id];

            snapshot[id] = {
                fill: fill,
                status: status,

                cycle60:
                    fill < 60
                        ? (
                            previous && previous.fill < 60
                                ? previous.cycle60 || previous.snapshotAt || now
                                : now
                        )
                        : (
                            previous?.cycle60 || now
                        ),

                cycle80:
                    fill < 80
                        ? (
                            previous && previous.fill < 80 
                                ? previous.cycle80 || previous.snapshotAt || now
                                : now
                        )
                        : (
                            previous?.cycle80 || now
                        ),

                statusVersion:
                    previous && previous.status === status
                        ? previous.statusVersion || previous.snapshotAt || now
                        : now,

                snapshotAt: now
            };
        });

        return snapshot;
    }

    // =====================================================
    // СОЗДАНИЕ УВЕДОМЛЕНИЯ
    // =====================================================

    async function createWorkerNotification(
        title,
        message,
        type,
        binId,
        eventKey
    ) {
        try {
            const data = await baserowRequest(
                WORKER_NOTIFICATIONS_TABLE_ID,
                "?user_field_names=true&size=200"
            );

            const notifications = data.results || [];

            const alreadyExists = notifications.some(
                function (item) {
                    return item["Ключ события"] === eventKey;
                }
            );

            if (alreadyExists) {
                console.log(
                    "Уведомление уже существует:",
                    eventKey
                );

                return true;
            }

            await baserowRequest(
                WORKER_NOTIFICATIONS_TABLE_ID,
                "?user_field_names=true",
                {
                    method: "POST",

                    body: JSON.stringify({
                        "Заголовок": title,
                        "Сообщения": message,
                        "Тип": type,
                        "ID мусорки": Number(binId),
                        "Ключ события": eventKey,
                        "Дата": new Date().toISOString()
                    })
                }
            );

            console.log(
                "Новое уведомление создано:",
                title
            );

            showBrowserNotification(title, message);

            return true;

        } catch (error) {
            console.error(
                "Ошибка создания уведомления:",
                error
            );

            return false;
        }
    }

    // =====================================================
    // БРАУЗЕРНЫЕ УВЕДОМЛЕНИЯ
    // =====================================================

    async function requestNotificationPermission() {
        if (!("Notification" in window)) {
            alert(
                "Этот браузер не поддерживает уведомления."
            );

            return;
        }

        if (Notification.permission === "granted") {
            alert(
                "Браузерные уведомления уже включены."
            );

            return;
        }

        if (Notification.permission === "denied") {
            alert(
                "Уведомления заблокированы. Разреши их в настройках сайта браузера."
            );

            return;
        }

        try {
            const permission =
                await Notification.requestPermission();

            console.log(
                "Разрешение уведомлений:",
                permission
            );

            if (permission === "granted") {
                alert(
                    "✅ Браузерные уведомления включены!"
                );
            } else {
                alert(
                    "Разрешение на уведомления не получено."
                );
            }

        } catch (error) {
            console.error(
                "Ошибка запроса разрешения:",
                error
            );
        }
    }

    function showBrowserNotification(title, message) {
        if (
            "Notification" in window &&
            Notification.permission === "granted"
        ) {
            try {
                new Notification(title, {
                    body: message,
                    icon: "favicon.ico"
                });

            } catch (error) {
                console.error(
                    "Ошибка браузерного уведомления:",
                    error
                );
            }
        }
    }

    // =====================================================
    // ПРОВЕРКА ИЗМЕНЕНИЙ
    // =====================================================

    async function checkWorkerNotifications() {
        if (isCheckingNotifications) {
            return;
        }

        if (
            !Array.isArray(bins) ||
            bins.length === 0
        ) {
            return;
        }

        isCheckingNotifications = true;

        try {
            const savedSnapshot =
                localStorage.getItem(
                    NOTIFICATIONS_STORAGE_KEY
                );

            let previousSnapshot = {};

            if (savedSnapshot) {
                try {
                    previousSnapshot =
                        JSON.parse(savedSnapshot) || {};

                } catch (error) {
                    console.error(
                        "Ошибка чтения истории уведомлений:",
                        error
                    );
                }
            }

            // Первый запуск
            if (
                !savedSnapshot ||
                Object.keys(previousSnapshot).length === 0
            ) {
                const initialSnapshot =
                    getNotificationSnapshot();

                localStorage.setItem(
                    NOTIFICATIONS_STORAGE_KEY,
                    JSON.stringify(initialSnapshot)
                );

                console.log(
                    "SmartBin: исходное состояние сохранено."
                );

                return;
            }

            const currentSnapshot =
                getNotificationSnapshot(previousSnapshot);

            let allNotificationsCreated = true;

            for (const row of bins) {
                const id = row.id;

                const current = currentSnapshot[id];
                const previous = previousSnapshot[id];

                if (!previous || !current) {
                    continue;
                }

                const location =
                    row["Место"] ??
                    row["Местоположение"] ??
                    row["Location"] ??
                    "Место не указано";

                // =========================================
                // 60%
                // =========================================

                if (
                    previous.fill < 60 &&
                    current.fill >= 60 &&
                    current.fill !> 80
                ) {
                    const success =
                        await createWorkerNotification(
                            "🟡 Мусорка почти зполнена",

                            `Мусорка #${id} (${location}) заполнена на ${current.fill}%.`,

                            "60%",

                            id,

                            `${id}_60_${previous.cycle60 || previous.snapshotAt}`
                        );

                    if (!success) {
                        allNotificationsCreated = false;
                    }
                }

                // =========================================
                // 80%
                // =========================================

                if (
                    previous.fill < 80 &&
                    current.fill >= 80
                ) {
                    const success =
                        await createWorkerNotification(
                            "🔴 Мусорка заполнена",

                            `Мусорка #${id} (${location}) заполнена на ${current.fill}%. Требуется внимание.`,

                            "80%",

                            id,

                            `${id}_80_${previous.cycle80 || previous.snapshotAt}`
                        );

                    if (!success) {
                        allNotificationsCreated = false;
                    }
                }

                // =========================================
                // ИЗМЕНЕНИЕ СТАТУСА
                // =========================================

                if (
                    previous.status !== current.status
                ) {
                    const statusNames = {
                        available: "Можно использовать",
                        almost: "Почти заполнена",
                        full: "Заполнена"
                    };

                    const success =
                        await createWorkerNotification(
                            "🔄 Изменился статус мусорки",

                            `Мусорка #${id} (${location}): ${statusNames[previous.status]} → ${statusNames[current.status]}.`,

                            "Изменение статуса",

                            id,

                            `${id}_status_${previous.status}_${current.status}_${previous.statusVersion || previous.snapshotAt}`
                        );

                    if (!success) {
                        allNotificationsCreated = false;
                    }
                }
            }

            // Сохраняем состояние после обработки
            if (allNotificationsCreated) {
                localStorage.setItem(
                    NOTIFICATIONS_STORAGE_KEY,
                    JSON.stringify(currentSnapshot)
                );

            } else {
                console.warn(
                    "Не все уведомления созданы. Повторим проверку позже."
                );
            }

        } catch (error) {
            console.error(
                "Ошибка проверки уведомлений:",
                error
            );

        } finally {
            isCheckingNotifications = false;
        }
    }

    // =====================================================
    // ПОДКЛЮЧЕНИЕ К ЗАГРУЗКЕ МУСОРОК
    // =====================================================

    function connectNotificationMonitoring() {
        if (monitoringStarted) {
            return;
        }

        if (
            typeof window.loadWorkerBins !== "function"
        ) {
            console.error(
                "SmartBin: loadWorkerBins не найдена."
            );

            return;
        }

        const originalLoadWorkerBins =
            window.loadWorkerBins;

        window.loadWorkerBins = async function () {
            await originalLoadWorkerBins.apply(
                this,
                arguments
            );

            await checkWorkerNotifications();
        };

        monitoringStarted = true;

        console.log(
            "SmartBin: мониторинг мусорок подключён."
        );

        // Проверка каждые 30 секунд
        setInterval(function () {
            if (
                typeof window.loadWorkerBins === "function"
            ) {
                window.loadWorkerBins();
            }
        }, NOTIFICATIONS_CHECK_INTERVAL);
    }

    // =====================================================
    // ЗАПУСК
    // =====================================================

    function startWorkerNotifications() {
        connectNotificationMonitoring();

        console.log(
            "SmartBin: система уведомлений запущена."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startWorkerNotifications
        );
    } else {
        startWorkerNotifications();
    }

    // =====================================================
    // ПУБЛИЧНЫЕ ФУНКЦИИ
    // =====================================================

    window.createWorkerNotification =
        createWorkerNotification;

    window.checkWorkerNotifications =
        checkWorkerNotifications;

    window.enableWorkerBrowserNotifications =
        requestNotificationPermission;

})();
