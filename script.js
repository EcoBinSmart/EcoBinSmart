// =====================================================
// SMARTBIN — SCRIPT.JS
// Мусорки из Baserow + пользователь из Baserow
// =====================================================


// =====================================================
// BASEROW
// =====================================================

// API Token Baserow
const BASEROW_TOKEN = "Mj2UZlEYI7cdzjpobnw1mjOwM4ik8Pok";

// Таблица мусорок
const BINS_TABLE_ID = "1216642";

// Таблица пользователей
const USERS_TABLE_ID = "1218099";

// Базовый адрес API
const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";


// =====================================================
// ФУНКЦИЯ ЗАПРОСА К BASEROW
// =====================================================

async function getBaserowData(tableId, endpoint = "") {

    const url =
        `${BASEROW_API}${tableId}/${endpoint}`;

    const separator =
        endpoint.includes("?") ? "&" : "?";

    const response = await fetch(
        `${url}${separator}user_field_names=true`,
        {
            method: "GET",

            headers: {
                "Authorization":
                    `Token ${BASEROW_TOKEN}`,

                "Content-Type":
                    "application/json"
            }
        }
    );

    if (!response.ok) {

        throw new Error(
            `Baserow error: ${response.status}`
        );
    }

    return await response.json();
}


// =====================================================
// ДАННЫЕ МУСОРОК
// =====================================================

let bins = [];


// =====================================================
// ЗАГРУЗКА МУСОРОК ИЗ BASEROW
// =====================================================

async function loadBins() {

    const container =
        document.getElementById(
            "binsContainer"
        );

    if (!container) {
        console.error(
            "Ошибка"
        );
        

        return;
    }


    try {

        container.innerHTML = `
            <div class="loading">
                Загрузка мусорок...
            </div>
        `;


        const data =
            await getBaserowData(
                BINS_TABLE_ID
            );


        bins =
            (data.results || []).map(
                function (row) {

                    // ID
                    const id =
                        row["ID"] ??
                        row["id"] ??
                        row["Id"] ??
                        row["Название"] ??
                        row.id;


                    // Местоположение
                    const location =
                        row["Место"] ??
                        row["Местоположение"] ??
                        row["Location"] ??
                        row["location"] ??
                        "Место не указано";


                    // Заполненность
                    let fill =
                        row["Заполненность"] ??
                        row["Заполненость"] ??
                        row["Fill"] ??
                        row["fill"] ??
                        0;


                    fill =
                        Number(fill);


                    if (
                        Number.isNaN(fill)
                    ) {
                        fill = 0;
                    }


                    // Ограничиваем 0–100
                    fill =
                        Math.max(
                            0,
                            Math.min(
                                100,
                                fill
                            )
                        );


                    // Статус
                    let status =
                        row["Статус"] ??
                        row["Status"] ??
                        row["status"] ??
                        "";


                    // Если статус не указан,
                    // рассчитываем его автоматически
                    if (!status) {

                        if (fill < 60) {

                            status =
                                "available";

                        } else if (fill < 80 && fill >= 60) {

                            status =
                                "almost";

                        } else {

                            status =
                                "full";
                        }
                    }


                    return {

                            id:
                                id ?? "—",
                        
                            location:
                                location,
                        
                            fill:
                                fill,
                        
                            status:
                                normalizeStatus(status),
                        
                            latitude:
                                Number(row["Latitude"]),
                        
                            longitude:
                                Number(row["Longitude"])
                        };
                }
            );


        console.log(
                    "Мусорки загружены:",
                    bins
                );
                
                
                // Показываем карточки
                showBins(bins);
                
                
                // Показываем мусорки на карте
                updateBinsMap(bins);


    } catch (error) {

        console.error(
            "Ошибка загрузки мусорок:",
            error
        );


        container.innerHTML = `
            <div class="error-message">

                ❌ Не удалось загрузить данные мусорок.
                <br><br>
            </div>
        `;
    }
}

// =====================================================
// OPENSTREETMAP + LEAFLET
// =====================================================

let binsMap = null;

let binsMarkers = [];


// Инициализация карты
function initializeBinsMap() {

    const mapElement =
        document.getElementById("binsMap");

    if (!mapElement) {
        console.error("Карта #binsMap не найдена.");
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet не загружен.");
        return;
    }

    if (binsMap) {
        return;
    }

    // Центр карты — Кокшетау
    binsMap = L.map("binsMap").setView(
        [53.2833, 69.3833],
        13
    );

    // Слой OpenStreetMap
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

            maxZoom: 19
        }
    ).addTo(binsMap);
}


// Цвет метки
function getMarkerColor(status) {

    if (status === "available") {
        return "#299452";
    }

    if (status === "almost") {
        return "#e5ae27";
    }

    if (status === "full") {
        return "#dc4545";
    }

    return "#737d76";
}


// Создание HTML метки
function createBinMarkerIcon(status) {

    const color =
        getMarkerColor(status);

    return L.divIcon({

        className: "custom-bin-marker",

        html: `
            <div style="
                width: 25px;
                height: 25px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 7px rgba(0,0,0,0.35);
            "></div>
        `,

        iconSize: [25, 25],

        iconAnchor: [12, 12],

        popupAnchor: [0, -12]
    });
}


// Обновление меток на карте
function updateBinsMap(list) {

    initializeBinsMap();

    if (!binsMap) {
        return;
    }

    // Удаляем старые метки
    binsMarkers.forEach(function(marker) {
        binsMap.removeLayer(marker);
    });

    binsMarkers = [];

    const validCoordinates = [];

    list.forEach(function(bin) {

        const latitude =
            bin.latitude;

        const longitude =
            bin.longitude;

        // Проверяем координаты
        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180 ||
            (latitude === 0 && longitude === 0)
        ) {
            console.warn(
                "У мусорки отсутствуют корректные координаты:",
                bin.id
            );

            return;
        }

        const marker =
            L.marker(
                [latitude, longitude],
                {
                    icon: createBinMarkerIcon(
                        bin.status
                    )
                }
            );

        // Карточка при нажатии
        marker.bindPopup(`
            <div class="map-popup">

                <h4>
                    🗑️ SmartBin #${escapeHTML(bin.id)}
                </h4>

                <p>
                    📍 ${escapeHTML(bin.location)}
                </p>

                <p>
                    <strong>Заполненность:</strong>
                    ${bin.fill}%
                </p>

                <p>
                    <strong>Статус:</strong>
                    ${getStatusText(bin.status)}
                </p>

            </div>
        `);

        marker.addTo(binsMap);

        binsMarkers.push(marker);

        validCoordinates.push([
            latitude,
            longitude
        ]);
    });

    // Автоматически показываем все найденные мусорки
    if (validCoordinates.length > 0) {

        if (validCoordinates.length === 1) {

            binsMap.setView(
                validCoordinates[0],
                16
            );

        } else {

            binsMap.fitBounds(
                validCoordinates,
                {
                    padding: [40, 40],
                    maxZoom: 16
                }
            );
        }

    } else {

        // Если координат пока нет — показываем Кокшетау
        binsMap.setView(
            [53.2833, 69.3833],
            13
        );
    }

    // Исправляем отображение размеров карты
    setTimeout(function() {
        binsMap.invalidateSize();
    }, 100);
}


// =====================================================
// ПРИВЕДЕНИЕ СТАТУСА К НОРМАЛЬНОМУ ВИДУ
// =====================================================

function normalizeStatus(status) {

    const value =
        String(status)
            .trim()
            .toLowerCase();


    if (
        value === "available" ||
        value === "можно выбрасывать"
    ) {
        return "available";
    }


    if (
        value === "almost" ||
        value === "почти заполнена"
    ) {
        return "almost";
    }


    if (
        value === "full" ||
        value === "заполнена"
    ) {
        return "full";
    }


    return "available";
}


// =====================================================
// ТЕКСТ СТАТУСА
// =====================================================

function getStatusText(status) {

    if (status === "available") {

        return "🟢 Можно выбрасывать";
    }


    if (status === "almost") {

        return "🟡 Почти заполнена";
    }


    if (status === "full") {

        return "🔴 Заполнена";
    }


    return "⚪ Неизвестно";
}


// =====================================================
// КЛАСС ПРОГРЕСС-БАРА
// =====================================================

function getProgressClass(status) {

    if (status === "available") {

        return "progress-green";
    }


    if (status === "almost") {

        return "progress-yellow";
    }


    if (status === "full") {

        return "progress-red";
    }


    return "";
}


// =====================================================
// ПОКАЗ МУСОРОК
// =====================================================

function showBins(list) {

    const container =
        document.getElementById(
            "binsContainer"
        );


    if (!container) {

        console.error(
            "Элемент #binsContainer не найден."
        );

        return;
    }


    container.innerHTML = "";


    if (list.length === 0) {

        container.innerHTML = `
            <p class="empty-message">
                Мусорок пока нет.
            </p>
        `;

        return;
    }


    list.forEach(
        function (bin) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "bin-card";


            card.innerHTML = `

                <h3>
                    🗑️ SmartBin #${bin.id}
                </h3>

                <div class="bin-location">
                    📍 ${escapeHTML(
                        bin.location
                    )}
                </div>

                <div class="bin-progress">

                    <div
                        class="
                            bin-progress-fill
                            ${getProgressClass(
                                bin.status
                            )}
                        "
                        style="
                            width: ${bin.fill}%
                        "
                    ></div>

                </div>

                <div class="bin-bottom">

                    <span class="fill-value">

                        Заполненность:
                        ${bin.fill}%

                    </span>

                    <span class="status">

                        ${getStatusText(
                            bin.status
                        )}

                    </span>

                </div>

            `;


            container.appendChild(
                card
            );
        }
    );
}


// =====================================================
// ЗАЩИТА ТЕКСТА
// =====================================================

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// =====================================================
// ФИЛЬТРЫ
// =====================================================

const filterButtons =
    document.querySelectorAll(
        ".filter-button"
    );


filterButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                filterButtons.forEach(
                    function (item) {

                        item.classList.remove(
                            "active"
                        );
                    }
                );


                button.classList.add(
                    "active"
                );


                const status =
                    button.dataset.status;


                if (
                    status === "all"
                ) {

                    showBins(bins);

                    return;
                }


                const filtered =
                    bins.filter(
                        function (bin) {

                            return (
                                bin.status ===
                                status
                            );
                        }
                    );


                showBins(
                    filtered
                );
            }
        );
    }
);


// =====================================================
// ПОЛЬЗОВАТЕЛЬ
// =====================================================

async function loadCurrentUser() {

    const loggedIn =
        localStorage.getItem(
            "smartbin_logged_in"
        );


    const userId =
        localStorage.getItem(
            "smartbin_user_id"
        );


    // Пользователь не вошёл
    if (
        loggedIn !== "true" ||
        !userId
    ) {

        return;
    }


    try {

        const user =
            await getBaserowData(
                USERS_TABLE_ID,
                `${userId}/`
            );


        console.log(
            "Пользователь из Baserow:",
            user
        );


        // Имя
        const username =
            user["user"] ??
            user["username"] ??
            user["Имя"] ??
            user["Имя пользователя"] ??
            "Пользователь";


        // Email
        const email =
            user["email"] ??
            user["Email"] ??
            "";


        // Обновляем сохранённые данные
        localStorage.setItem(
            "smartbin_username",
            username
        );


        localStorage.setItem(
            "smartbin_email",
            email
        );


        // =================================================
        // ПЕРЕДАЁМ ДАННЫЕ В INDEX.HTML
        // =================================================

        const accountName =
            document.getElementById(
                "accountName"
            );


        const dropdownName =
            document.getElementById(
                "dropdownName"
            );


        const dropdownEmail =
            document.getElementById(
                "dropdownEmail"
            );


        if (accountName) {

            accountName.textContent =
                username;
        }


        if (dropdownName) {

            dropdownName.textContent =
                username;
        }


        if (dropdownEmail) {

            dropdownEmail.textContent =
                email ||
                "Email не указан";
        }


        // Показываем аккаунт
        const accountMenu =
            document.getElementById(
                "accountMenu"
            );


        const loginButton =
            document.getElementById(
                "loginButton"
            );


        if (accountMenu) {

            accountMenu.style.display =
                "block";
        }


        if (loginButton) {

            loginButton.style.display =
                "none";
        }


    } catch (error) {

        console.error(
            "Ошибка загрузки пользователя:",
            error
        );
    }
}


// =====================================================
// ЗАПУСК
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        // Загружаем мусорки
        loadBins();

        // Загружаем пользователя
        loadCurrentUser();

    }
);ы
