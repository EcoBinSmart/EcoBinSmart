// =====================================================
// SMARTBIN — WORKER.JS
// Рабочая панель мусоровоза
// =====================================================


// =====================================================
// BASEROW
// =====================================================

const BASEROW_TOKEN =
    "Mj2UZlEYI7cdzjpobnw1mjOwM4ik8Pok";

const BINS_TABLE_ID =
    "1216642";

const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";


// =====================================================
// СОСТОЯНИЕ
// =====================================================

let bins = [];

let selectedBin = null;


// =====================================================
// ПРОВЕРКА РАБОЧЕГО АККАУНТА
// =====================================================

function checkWorkerLogin() {
    return true;
}

// =====================================================
// ЗАПРОС BASEROW
// =====================================================

async function baserowRequest(
    tableId,
    endpoint = "",
    options = {}
) {

    const response =
        await fetch(
            `${BASEROW_API}${tableId}/${endpoint}`,
            {
                ...options,

                headers: {
                    "Authorization":
                        `Token ${BASEROW_TOKEN}`,

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );


    if (!response.ok) {

        const text =
            await response.text();

        throw new Error(
            `Baserow ${response.status}: ${text}`
        );
    }


    return await response.json();
}


// =====================================================
// ЗАГРУЗКА МУСОРОК
// =====================================================

async function loadWorkerBins() {

    const container =
        document.getElementById(
            "workerBinsContainer"
        );


    try {

        container.innerHTML = `
            <div class="loading">
                Загрузка мусорок...
            </div>
        `;


        const data =
            await baserowRequest(
                BINS_TABLE_ID,
                "?user_field_names=true"
            );


        bins =
            data.results || [];


        renderWorkerBins();

        updateStatistics();


    } catch (error) {

        console.error(
            error
        );


        container.innerHTML = `
            <div class="loading">

                ❌ Не удалось загрузить
                мусорки.

                <br><br>

                Проверь подключение
                к Baserow.

            </div>
        `;
    }
}


// =====================================================
// ПОЛУЧЕНИЕ ЗАПОЛНЕННОСТИ
// =====================================================

function getFill(row) {

    let fill =
        row["Заполненность"] ??
        row["Заполненость"] ??
        row["Fill"] ??
        row["fill"] ??
        0;


    fill =
        Number(fill);


    if (Number.isNaN(fill)) {

        fill = 0;
    }


    return Math.max(
        0,
        Math.min(
            100,
            fill
        )
    );
}


// =====================================================
// ОПРЕДЕЛЕНИЕ СТАТУСА
// =====================================================

function getStatus(fill) {

    if (fill < 60) {

        return "available";
    }


    if (fill < 90) {

        return "almost";
    }


    return "full";
}


// =====================================================
// НАЗВАНИЕ СТАТУСА
// =====================================================

function getStatusText(status) {

    if (status === "available") {

        return "🟢 Можно использовать";
    }


    if (status === "almost") {

        return "🟡 Почти заполнена";
    }


    return "🔴 Заполнена";
}


// =====================================================
// ПОКАЗ МУСОРОК
// =====================================================

function renderWorkerBins() {

    const container =
        document.getElementById(
            "workerBinsContainer"
        );


    container.innerHTML = "";


    if (bins.length === 0) {

        container.innerHTML = `
            <div class="loading">
                Мусорок пока нет.
            </div>
        `;

        return;
    }


    bins.forEach(
        function (row) {

            const fill =
                getFill(row);


            const status =
                getStatus(fill);


            const location =
                row["Место"] ??
                row["Местоположение"] ??
                row["Location"] ??
                "Место не указано";


            const id =
                row.id ??
                row["ID"] ??
                "—";


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "bin-card";


            card.innerHTML = `

                <h3>
                    🗑️ SmartBin #${id}
                </h3>

                <div class="location">
                    📍 ${location}
                </div>

                <div class="progress-background">

                    <div
                        class="
                            progress-fill
                            progress-${status === "available"
                                ? "green"
                                : status === "almost"
                                ? "yellow"
                                : "red"}
                        "
                        style="
                            width: ${fill}%
                        "
                    ></div>

                </div>


                <div class="bin-details">

                    <span class="fill">
                        Заполненность:
                        ${fill}%
                    </span>

                    <span class="status">
                        ${getStatusText(
                            status
                        )}
                    </span>

                </div>


                <button
                    class="clear-button"
                    data-id="${row.id}"
                >

                    ${
                        fill === 0
                            ? "✅ Мусорка пуста"
                            : "🚛 Отметить как очищенную"
                    }

                </button>

            `;


            const button =
                card.querySelector(
                    ".clear-button"
                );


            if (fill === 0) {

                button.disabled =
                    true;
            }


            button.addEventListener(
                "click",
                function () {

                    selectedBin =
                        row;

                    openModal();

                }
            );


            container.appendChild(
                card
            );
        }
    );
}


// =====================================================
// СТАТИСТИКА
// =====================================================

function updateStatistics() {

    const total =
        bins.length;


    let full = 0;

    let almost = 0;


    bins.forEach(
        function (row) {

            const fill =
                getFill(row);


            if (fill >= 90) {

                full++;

            } else if (fill >= 60) {

                almost++;
            }
        }
    );


    document.getElementById(
        "totalBins"
    ).textContent = total;


    document.getElementById(
        "fullBins"
    ).textContent = full;


    document.getElementById(
        "almostBins"
    ).textContent = almost;
}


// =====================================================
// ОТКРЫТЬ ОКНО
// =====================================================

function openModal() {

    document
        .getElementById(
            "confirmModal"
        )
        .classList.remove(
            "hidden"
        );
}


// =====================================================
// ЗАКРЫТЬ ОКНО
// =====================================================

function closeModal() {

    document
        .getElementById(
            "confirmModal"
        )
        .classList.add(
            "hidden"
        );


    selectedBin = null;
}


// =====================================================
// ОЧИСТКА МУСОРКИ
// =====================================================

async function clearBin() {

    if (!selectedBin) {

        return;
    }


    const button =
        document.getElementById(
            "confirmButton"
        );


    button.disabled =
        true;


    button.textContent =
        "Обновление...";


    try {

        await baserowRequest(
            BINS_TABLE_ID,
            `${selectedBin.id}/?user_field_names=true`,
            {
                method: "PATCH",

                body: JSON.stringify({

                    "Заполненность": 0

                })
            }
        );


        closeModal();


        await loadWorkerBins();


        alert(
            "✅ Мусорка успешно отмечена как очищенная."
        );


    } catch (error) {

        console.error(
            error
        );


        alert(
            "❌ Не удалось обновить мусорку."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Да, очищена";
    }
}


// =====================================================
// ВЫХОД
// =====================================================

function logoutWorker() {

    localStorage.removeItem(
        "smartbin_worker_logged_in"
    );

    localStorage.removeItem(
        "smartbin_worker_id"
    );

    localStorage.removeItem(
        "smartbin_worker_username"
    );

    localStorage.removeItem(
        "smartbin_worker_company"
    );


    window.location.href =
        "worker-login.html";
}


// =====================================================
// ЗАПУСК
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        if (!checkWorkerLogin()) {

            return;
        }


        const workerName =
            localStorage.getItem(
                "smartbin_worker_username"
            ) ||
            "Работник";


        const company =
            localStorage.getItem(
                "smartbin_worker_company"
            ) ||
            "Компания";


        document.getElementById(
            "workerName"
        ).textContent =
            workerName;


        document.getElementById(
            "welcomeName"
        ).textContent =
            workerName;


        document.getElementById(
            "workerCompany"
        ).textContent =
            company;


        document.getElementById(
            "refreshButton"
        ).addEventListener(
            "click",
            loadWorkerBins
        );


        document.getElementById(
            "logoutButton"
        ).addEventListener(
            "click",
            logoutWorker
        );


        document.getElementById(
            "cancelButton"
        ).addEventListener(
            "click",
            closeModal
        );


        document.getElementById(
            "confirmButton"
        ).addEventListener(
            "click",
            clearBin
        );


        loadWorkerBins();

    }
);