
// =====================================================
// SMARTBIN — УВЕДОМЛЕНИЯ ДЛЯ РАБОТНИКОВ
// =====================================================

const WORKER_NOTIFICATIONS_TABLE_ID = "1335863";

const NOTIFICATIONS_CHECK_INTERVAL = 30000;

const NOTIFICATIONS_STORAGE_KEY = "smartbin_notification_snapshot";


// =====================================================
// ПОЛУЧЕНИЕ СОСТОЯНИЯ МУСОРОК
// =====================================================

function getNotificationSnapshot() {

    const snapshot = {};

    bins.forEach(function (row) {

        const id = row.id;
        const fill = getFill(row);
        const status = getStatus(fill);

        snapshot[id] = {
            fill: fill,
            status: status
        };

    });

    return snapshot;
}


// =====================================================
// СОЗДАНИЕ УВЕДОМЛЕНИЯ В BASEROW
// =====================================================

async function createWorkerNotification(
    title,
    message,
    type,
    binId,
    eventKey
) {

    try {

        // Проверяем, не существует ли уже такое событие
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
            return;
        }

        // Создаём запись
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

    } catch (error) {

        console.error(
            "Ошибка создания уведомления:",
            error
        );

    }
}


// =====================================================
// БРАУЗЕРНЫЕ УВЕДОМЛЕНИЯ
// =====================================================

async function requestNotificationPermission() {

    if (!("Notification" in window)) {
        return;
    }

    if (Notification.permission === "default") {

        const permission =
            await Notification.requestPermission();

        console.log(
            "Разрешение уведомлений:",
            permission
        );
    }
}


function showBrowserNotification(title, message) {

    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        new Notification(title, {
            body: message,
            icon: "favicon.ico"
        });

    }
}


// =====================================================
// ПРОВЕРКА ИЗМЕНЕНИЙ
// =====================================================

async function checkWorkerNotifications() {

    if (!Array.isArray(bins) || bins.length === 0) {
        return;
    }

    const currentSnapshot = getNotificationSnapshot();

    const savedSnapshot = localStorage.getItem(
        NOTIFICATIONS_STORAGE_KEY
    );

    // Первый запуск: сохраняем исходное состояние
    // и не создаём ложные уведомления
    if (!savedSnapshot) {

        localStorage.setItem(
            NOTIFICATIONS_STORAGE_KEY,
            JSON.stringify(currentSnapshot)
        );

        return;
    }

    const previousSnapshot = JSON.parse(savedSnapshot);

    const now = Math.floor(Date.now() / 60000);

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


        // =================================================
        // УВЕДОМЛЕНИЕ: 60%
        // =================================================

        if (
            previous.fill < 60 &&
            current.fill >= 60
        ) {

            await createWorkerNotification(

                "🟡 Мусорка заполнена на 60%",

                `Мусорка #${id} (${location}) заполнена на ${current.fill}%.`,

                "60%",

                id,

                `${id}_60_${now}`

            );
        }


        // =================================================
        // УВЕДОМЛЕНИЕ: 80%
        // =================================================

        if (
            previous.fill < 80 &&
            current.fill >= 80
        ) {

            await createWorkerNotification(

                "🔴 Мусорка заполнена на 80%",

                `Мусорка #${id} (${location}) заполнена на ${current.fill}%. Требуется внимание.`,

                "80%",

                id,

                `${id}_80_${now}`

            );
        }


        // =================================================
        // ИЗМЕНЕНИЕ СТАТУСА
        // =================================================

        if (
            previous.status !== current.status
        ) {

            const statusNames = {
                available: "Можно использовать",
                almost: "Почти заполнена",
                full: "Заполнена"
            };

            await createWorkerNotification(

                "🔄 Изменился статус мусорки",

                `Мусорка #${id} (${location}): ${statusNames[previous.status]} → ${statusNames[current.status]}.`,

                "Изменение статуса",

                id,

                `${id}_status_${previous.status}_${current.status}_${now}`

            );
        }

    }

    // Сохраняем новое состояние
    localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(currentSnapshot)
    );

}


// =====================================================
// ПОДКЛЮЧЕНИЕ К ЗАГРУЗКЕ МУСОРОК
// =====================================================

const originalLoadWorkerBins = window.loadWorkerBins;

if (typeof originalLoadWorkerBins === "function") {

    window.loadWorkerBins = async function () {

        await originalLoadWorkerBins();

        await checkWorkerNotifications();

    };

} else {

    console.error(
        "Не найдена функция loadWorkerBins"
    );

}


// =====================================================
// ЗАПУСК
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        requestNotificationPermission();

        // Каждые 30 секунд загружаем свежие данные из Baserow
        setInterval(async function () {

            if (typeof window.loadWorkerBins === "function") {

                await window.loadWorkerBins();

            } else {

                console.error(
                    "Не найдена функция loadWorkerBins"
                );

            }

        }, NOTIFICATIONS_CHECK_INTERVAL);

    }
);
