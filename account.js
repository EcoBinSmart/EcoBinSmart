// =====================================================
// SMARTBIN — АККАУНТ
// =====================================================

const isLoggedIn =
    localStorage.getItem("smartbin_logged_in") === "true";

const username =
    localStorage.getItem("smartbin_username");

const email =
    localStorage.getItem("smartbin_email");


const loginButton =
    document.getElementById("loginButton");

const accountMenu =
    document.getElementById("accountMenu");

const accountButton =
    document.getElementById("accountButton");

const accountName =
    document.getElementById("accountName");

const dropdownName =
    document.getElementById("dropdownName");

const dropdownEmail =
    document.getElementById("dropdownEmail");

const accountDropdown =
    document.getElementById("accountDropdown");

const logoutButton =
    document.getElementById("logoutButton");


// =====================================================
// СОСТОЯНИЕ АККАУНТА
// =====================================================

if (isLoggedIn && username) {

    loginButton.style.display = "none";

    accountMenu.style.display = "block";

    accountName.textContent =
        username;

    dropdownName.textContent =
        username;

    dropdownEmail.textContent =
        email || "Email не указан";

} else {

    loginButton.style.display = "block";

    accountMenu.style.display = "none";

}


// =====================================================
// ОТКРЫТИЕ МЕНЮ
// =====================================================

if (accountButton) {

    accountButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            accountDropdown.classList.toggle("show");

        }
    );

}


// =====================================================
// ЗАКРЫТИЕ
// =====================================================

document.addEventListener(
    "click",
    function () {

        accountDropdown.classList.remove("show");

    }
);


// =====================================================
// ВЫХОД
// =====================================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        function () {

            localStorage.removeItem(
                "smartbin_logged_in"
            );

            localStorage.removeItem(
                "smartbin_username"
            );

            localStorage.removeItem(
                "smartbin_email"
            );

            localStorage.removeItem(
                "smartbin_user_id"
            );

            window.location.href =
                "index.html";

        }
    );

}