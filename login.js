const BASEROW_TOKEN =
    "U9uhzT7gByp0Aeaq1JElxmLUUFuufs2j";

const USERS_TABLE_ID =
    "1218909";

const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";

const loginForm =
    document.getElementById("loginForm");

const loginInput =
    document.getElementById("login");

const passwordInput =
    document.getElementById("password");

const message =
    document.getElementById("loginMessage");

const loginButton =
    document.getElementById("loginButton");


function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type}`;
}


async function getUsers() {
    const response = await fetch(
        `${BASEROW_API}${USERS_TABLE_ID}/?user_field_names=true`,
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
            `Ошибка Baserow: ${response.status}`
        );
    }

    return await response.json();
}


loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const login =
            loginInput.value.trim();

        const password =
            passwordInput.value;

        if (!login || !password) {
            showMessage(
                "Введите логин и пароль."
            );

            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Вход...";

        showMessage("");

        try {

            const data =
                await getUsers();

            const users =
                data.results || [];

            const user =
                users.find(function (row) {

                    const username =
                        String(
                            row["username"] ??
                            row["Имя пользователя"] ??
                            row["user"] ??
                            ""
                        ).trim();

                    const email =
                        String(
                            row["email"] ??
                            row["Email"] ??
                            ""
                        ).trim();

                    const rowPassword =
                        String(
                            row["password"] ??
                            row["Пароль"] ??
                            ""
                        );

                    const loginMatches =
                        login.toLowerCase() ===
                            username.toLowerCase()
                        ||
                        login.toLowerCase() ===
                            email.toLowerCase();

                    const passwordMatches =
                        password === rowPassword;

                    return (
                        loginMatches &&
                        passwordMatches
                    );
                });


            if (!user) {

                showMessage(
                    "Неверный логин или пароль."
                );

                return;
            }


            const username =
                user["username"] ??
                user["Имя пользователя"] ??
                user["user"] ??
                "Пользователь";

            const email =
                user["email"] ??
                user["Email"] ??
                "";


            localStorage.setItem(
                "smartbin_logged_in",
                "true"
            );

            localStorage.setItem(
                "smartbin_user_id",
                String(user.id)
            );

            localStorage.setItem(
                "smartbin_username",
                username
            );

            localStorage.setItem(
                "smartbin_email",
                email
            );


            showMessage(
                "Вход выполнен. Перенаправление...",
                "success"
            );


            setTimeout(function () {

                window.location.href =
                    "index.html";

            }, 500);


        } catch (error) {

            console.error(error);

            showMessage(
                "Проверьте подключение к интернету."
            );

        } finally {

            loginButton.disabled = false;
            loginButton.textContent = "Войти";
        }
    }
);