
"use strict";

// =====================================================
// SMARTBIN — WORKER MAP
// =====================================================


// =====================================================
// BASEROW
// =====================================================

// Вставь сюда API-токен, который используется
// в твоём worker.js.

const BASEROW_TOKEN = "Mj2UZlEYI7cdzjpobnw1mjOwM4ik8Pok";

const BINS_TABLE_ID = "1216642";

const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";



// =====================================================
// СОСТОЯНИЕ
// =====================================================

let bins = [];

let markers = {};

let selectedFilter = "all";

let selectedBinId = null;

let isLoading = false;

let firstMapLoad = true;


// =====================================================
// КАРТА
// =====================================================

const map = L.map("workerMap", {
    zoomControl: true
}).setView([53.2833, 69.3833], 13);


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

        maxZoom: 19
    }
).addTo(map);


// =====================================================
// ЭЛЕМЕНТЫ
// =====================================================

const binsList =
    document.getElementById("binsList");

const mapLoading =
    document.getElementById("mapLoading");


// =====================================================
// BASEROW REQUEST
// =====================================================

async function baserowRequest(
    tableId,
    endpoint = ""
) {

    const response = await fetch(
        `${BASEROW_API}${tableId}/${endpoint}`,
        {
            headers: {
                "Authorization":
                    `Token ${BASEROW_TOKEN}`,

                "Content-Type":
                    "application/json"
            }
        }
    );

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Baserow ${response.status}: ${errorText}`
        );
    }

    return await response.json();
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

    fill = Number(fill);

    if (!Number.isFinite(fill)) {
        fill = 0;
    }

    return Math.max(
        0,
        Math.min(100, fill)
    );
}


// =====================================================
// ПОЛУЧЕНИЕ СТАТУСА
// =====================================================

function getStatus(fill) {

    if (fill < 60) {
        return "available";
    }

    if (fill < 80) {
        return "almost";
    }

    return "full";
}


function getStatusText(status) {

    if (status === "available") {
        return "Можно использовать";
    }

    if (status === "almost") {
        return "Почти заполнена";
    }

    return "Заполнена";
}


// =====================================================
// НАЗВАНИЕ И МЕСТО
// =====================================================

function getBinName(row) {

    return (
        row["Название"] ??
        row["Название мусорки"] ??
        row["Name"] ??
        `SmartBin #${row.id}`
    );
}


function getBinLocation(row) {

    return (
        row["Место"] ??
        row["Местоположение"] ??
        row["Location"] ??
        "Место не указано"
    );
}


// =====================================================
// КООРДИНАТЫ
// =====================================================

function getCoordinates(row) {

    const lat = Number(
        row["Latitude"] ??
        row["latitude"] ??
        row["Широта"] ??
        row["Lat"] ??
        row["lat"]
    );

    const lng = Number(
        row["Longitude"] ??
        row["longitude"] ??
        row["Долгота"] ??
        row["Lng"] ??
        row["lng"]
    );

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {
        return null;
    }

    if (
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {
        return null;
    }

    if (lat === 0 && lng === 0) {
        return null;
    }

    return {
        lat,
        lng
    };
}


// =====================================================
// СОЗДАНИЕ ИКОНКИ
// =====================================================

function createBinIcon(status) {

    return L.divIcon({

        className: "custom-bin-marker",

        html: `
            <div class="bin-marker-pin ${status}"></div>
        `,

        iconSize: [36, 36],

        iconAnchor: [18, 36],

        popupAnchor: [0, -35]

    });
}


// =====================================================
// СОЗДАНИЕ POPUP
// =====================================================

function createPopup(row) {

    const fill = getFill(row);

    const status = getStatus(fill);

    const location = getBinLocation(row);

    const name = getBinName(row);

    const color =
        status === "available"
            ? "#299452"
            : status === "almost"
            ? "#d5a72c"
            : "#d95353";


    const popup = document.createElement("div");

    popup.className = "map-popup";


    const heading = document.createElement("h3");

    heading.textContent = name;


    const locationText = document.createElement("p");

    locationText.textContent =
        "📍 " + location;


    const fillText = document.createElement("p");

    fillText.textContent =
        `Заполненность: ${fill}%`;


    const statusText = document.createElement("p");

    statusText.textContent =
        getStatusText(status);


    const progress = document.createElement("div");

    progress.className = "popup-progress";


    const progressFill =
        document.createElement("div");

    progressFill.className =
        "popup-progress-fill";

    progressFill.style.width = `${fill}%`;

    progressFill.style.background = color;


    progress.appendChild(progressFill);

    popup.append(
        heading,
        locationText,
        fillText,
        statusText,
        progress
    );

    return popup;
}


// =====================================================
// ЗАГРУЗКА МУСОРОК
// =====================================================

async function loadBins() {

    if (isLoading) return;

    isLoading = true;

    mapLoading.classList.remove("hidden");


    try {

        const data = await baserowRequest(
            BINS_TABLE_ID,
            "?user_field_names=true&size=200"
        );

        bins = data.results || [];

        renderMarkers();

        renderBinsList();

        updateStatistics();

        updateLastUpdate();

        if (firstMapLoad) {

            fitMapToBins();

            firstMapLoad = false;
        }

    } catch (error) {

        console.error(
            "Ошибка загрузки карты:",
            error
        );

        if (bins.length === 0) {

            binsList.innerHTML = `
                <div class="list-empty">
                    ❌ Не удалось загрузить мусорки.
                    <br><br>
                    Проверь API-токен и подключение к Baserow.
                </div>
            `;
        }

    } finally {

        isLoading = false;

        mapLoading.classList.add("hidden");

    }
}


// =====================================================
// ОТОБРАЖЕНИЕ МАРКЕРОВ
// =====================================================

function renderMarkers() {

    Object.values(markers).forEach(
        marker => map.removeLayer(marker)
    );

    markers = {};


    bins.forEach(row => {

        const coordinates =
            getCoordinates(row);

        if (!coordinates) {
            return;
        }

        const fill = getFill(row);

        const status = getStatus(fill);

        const marker = L.marker(
            [
                coordinates.lat,
                coordinates.lng
            ],
            {
                icon: createBinIcon(status)
            }
        );


        marker.bindPopup(
            createPopup(row)
        );


        marker.on("click", function () {

            selectedBinId = row.id;

            renderBinsList();

        });


        if (selectedFilter === "all" ||
            selectedFilter === status) {

            marker.addTo(map);
        }


        markers[row.id] = marker;

    });

}


// =====================================================
// СПИСОК МУСОРОК
// =====================================================

function renderBinsList() {

    binsList.innerHTML = "";

    const filteredBins = bins.filter(row => {

        const status = getStatus(getFill(row));

        return (
            selectedFilter === "all" ||
            selectedFilter === status
        );

    });


    document.getElementById(
        "visibleCount"
    ).textContent = filteredBins.length;


    if (filteredBins.length === 0) {

        binsList.innerHTML = `
            <div class="list-empty">
                Мусорок с таким статусом нет.
            </div>
        `;

        return;
    }


    filteredBins.forEach(row => {

        const fill = getFill(row);

        const status = getStatus(fill);

        const coordinates = getCoordinates(row);


        const item =
            document.createElement("div");

        item.className = "bin-list-item";

        if (selectedBinId === row.id) {
            item.classList.add("selected");
        }


        const title =
            document.createElement("div");

        title.className = "bin-list-title";


        const name =
            document.createElement("strong");

        name.textContent = getBinName(row);


        const fillText =
            document.createElement("span");

        fillText.className = "bin-list-fill";

        fillText.textContent = `${fill}%`;


        title.append(name, fillText);


        const location =
            document.createElement("div");

        location.className = "bin-list-location";

        location.textContent =
            "📍 " + getBinLocation(row);


        const statusText =
            document.createElement("div");

        statusText.className =
            `bin-list-status ${status}`;

        statusText.textContent =
            getStatusText(status);


        item.append(
            title,
            location,
            statusText
        );


        item.addEventListener("click", () => {

            if (!coordinates) {

                alert(
                    "У этой мусорки не указаны координаты."
                );

                return;
            }

            selectedBinId = row.id;

            renderBinsList();


            const marker = markers[row.id];

            if (marker) {

                if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }

                map.flyTo(
                    [
                        coordinates.lat,
                        coordinates.lng
                    ],
                    17
                );

                marker.openPopup();
            }

        });


        binsList.appendChild(item);

    });

}


// =====================================================
// ФИЛЬТРАЦИЯ МАРКЕРОВ
// =====================================================

function applyFilter(filter) {

    selectedFilter = filter;

    document.querySelectorAll(
        ".filter-button"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.filter === filter
        );

    });


    Object.entries(markers).forEach(
        ([id, marker]) => {

            const row = bins.find(
                item => String(item.id) === String(id)
            );

            if (!row) return;

            const status = getStatus(getFill(row));

            const shouldShow =
                filter === "all" ||
                filter === status;

            if (shouldShow) {

                if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }

            } else {

                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }

            }

        }
    );


    renderBinsList();

}


// =====================================================
// СТАТИСТИКА
// =====================================================

function updateStatistics() {

    let almost = 0;

    let full = 0;

    bins.forEach(row => {

        const status = getStatus(getFill(row));

        if (status === "almost") {
            almost++;
        }

        if (status === "full") {
            full++;
        }

    });


    document.getElementById(
        "totalBins"
    ).textContent = bins.length;


    document.getElementById(
        "almostBins"
    ).textContent = almost;


    document.getElementById(
        "fullBins"
    ).textContent = full;

}


// =====================================================
// АВТОМАСШТАБИРОВАНИЕ
// =====================================================

function fitMapToBins() {

    const points = [];

    bins.forEach(row => {

        const coordinates = getCoordinates(row);

        if (coordinates) {

            points.push([
                coordinates.lat,
                coordinates.lng
            ]);

        }

    });


    if (points.length === 1) {

        map.setView(points[0], 16);

    } else if (points.length > 1) {

        map.fitBounds(points, {
            padding: [40, 40],
            maxZoom: 16
        });

    }

}


// =====================================================
// ВРЕМЯ ОБНОВЛЕНИЯ
// =====================================================

function updateLastUpdate() {

    const now = new Date();

    document.getElementById(
        "lastUpdate"
    ).textContent =
        "Последнее обновление: " +
        now.toLocaleTimeString("ru-RU");

}


// =====================================================
// ИНФОРМАЦИЯ О РАБОТНИКЕ
// =====================================================

function loadWorkerInfo() {

    const name =
        localStorage.getItem(
            "smartbin_worker_username"
        ) || "Работник";


    const company =
        localStorage.getItem(
            "smartbin_worker_company"
        ) || "Компания";


    document.getElementById(
        "workerName"
    ).textContent = name;


    document.getElementById(
        "workerCompany"
    ).textContent = company;

}


// =====================================================
// СОБЫТИЯ
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadWorkerInfo();


        document.getElementById(
            "refreshButton"
        ).addEventListener(
            "click",
            loadBins
        );


        document.querySelectorAll(
            ".filter-button"
        ).forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    applyFilter(
                        this.dataset.filter
                    );

                }
            );

        });


        loadBins();


        // Исправление размеров карты после загрузки

        setTimeout(
            () => map.invalidateSize(),
            300
        );

    }
);
