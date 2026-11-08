// =====================================================
// SMARTBIN — РЕГИСТРАЦИЯ
// =====================================================


// =====================================================
// BASEROW
// =====================================================

const BASEROW_TOKEN =
    "U9uhzT7gByp0Aeaq1JElxmLUUFuufs2j";

const USERS_TABLE_ID =
    "1218909";

const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";


// =====================================================
// ЭЛЕМЕНТЫ ФОРМЫ
// =====================================================

const registerForm =
    document.getElementById("registerForm");

const usernameInput =
    document.getElementById("username");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const confirmPasswordInput =
    document.getElementById("confirmPassword");

const registerMessage =
    document.getElementById("registerMessage");

const registerButton =
    document.getElementsByClassName("register-button");


// =====================================================
// ПОКАЗ СООБЩЕНИЯ
// =====================================================

function showMessage(
    text,
    type = "error"
) {

    if (!registerMessage) {
        return;
    }

    registerMessage.textContent =
        text;

    registerMessage.className =
        `message ${type}`;
}


// =====================================================
// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЕЙ
// =====================================================

async function getUsers() {

    const response =
        await fetch(
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
            `Ошибка получения пользователей: ${response.status}`
        );
    }


    return await response.json();
}


// =====================================================
// СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function createUser(
    username,
    email,
    password
) {

    const response =
        await fetch(
            `${BASEROW_API}${USERS_TABLE_ID}/?user_field_names=true`,
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Token ${BASEROW_TOKEN}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username:
                        username,

                    email:
                        email,

                    password:
                        password

                })
            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();

        console.error(
            "Baserow:",
            errorText
        );

        throw new Error(
            `Ошибка создания пользователя: ${response.status}`
        );
    }


    return await response.json();
}


// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

registerForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const username =
            usernameInput.value.trim();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;

        const confirmPassword =
            confirmPasswordInput.value;


        // =================================================
        // ПРОВЕРКИ
        // =================================================

        if (
            !username ||
            !email ||
            !password ||
            !confirmPassword
        ) {

            showMessage(
                "Заполните все поля."
            );

            return;
        }


        if (username.length < 3) {

            showMessage(
                "Имя пользователя должно содержать минимум 3 символа."
            );

            return;
        }


        if (password.length < 4) {

            showMessage(
                "Пароль должен содержать минимум 4 символа."
            );

            return;
        }


        if (password !== confirmPassword) {

            showMessage(
                "Пароли не совпадают."
            );

            return;
        }


        // Простая проверка email

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (!emailPattern.test(email)) {

            showMessage(
                "Введите корректный Email."
            );

            return;
        }


        // =================================================
        // БЛОКИРУЕМ КНОПКУ
        // =================================================

        registerButton.disabled =
            true;

        registerButton.textContent =
            "Регистрация...";


        showMessage("");


        try {

            // =================================================
            // ПОЛУЧАЕМ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ
            // =================================================

            const data =
                await getUsers();

            const users =
                data.results || [];


            // =================================================
            // ПРОВЕРЯЕМ USERNAME
            // =================================================

            const usernameExists =
                users.some(
                    function (row) {

                        const existingUsername =
                            String(
                                row["username"] ??
                                row["Имя пользователя"] ??
                                row["user"] ??
                                ""
                            ).trim();


                        return (
                            existingUsername.toLowerCase() ===
                            username.toLowerCase()
                        );
                    }
                );


            if (usernameExists) {

                showMessage(
                    "Это имя пользователя уже занято."
                );

                return;
            }


            // =================================================
            // ПРОВЕРЯЕМ EMAIL
            // =================================================

            const emailExists =
                users.some(
                    function (row) {

                        const existingEmail =
                            String(
                                row["email"] ??
                                row["Email"] ??
                                ""
                            ).trim();


                        return (
                            existingEmail.toLowerCase() ===
                            email.toLowerCase()
                        );
                    }
                );


            if (emailExists) {

                showMessage(
                    "Этот Email уже зарегистрирован."
                );

                return;
            }


            // =================================================
            // СОЗДАЁМ ПОЛЬЗОВАТЕЛЯ
            // =================================================

            const createdUser =
                await createUser(
                    username,
                    email,
                    password
                );


            // =================================================
            // СОХРАНЯЕМ СЕССИЮ
            // =================================================

            localStorage.setItem(
                "smartbin_logged_in",
                "true"
            );


            localStorage.setItem(
                "smartbin_user_id",
                String(createdUser.id)
            );


            localStorage.setItem(
                "smartbin_username",
                username
            );


            localStorage.setItem(
                "smartbin_email",
                email
            );


            // =================================================
            // СООБЩЕНИЕ
            // =================================================

            showMessage(
                "Регистрация успешна!",
                "success"
            );


            // =================================================
            // ПЕРЕХОД НА ГЛАВНУЮ
            // =================================================

            setTimeout(
                function () {

                    window.location.href =
                        "index.html";

                },
                500
            );


        } catch (error) {

            console.error(
                error
            );


            showMessage(
                "Не удалось зарегистрировать аккаунт. Проверьте подключение к Baserow."
            );


        } finally {

            registerButton.disabled =
                false;

            registerButton.textContent =
                "Зарегистрироваться";
        }
    }
);