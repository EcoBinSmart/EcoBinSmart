const BASEROW_TOKEN =
    "miWRZu9FvwNa7F18awY4BtyHFM7xShOd";

const WORKERS_TABLE_ID =
    "1232100";

const BASEROW_API =
    "https://api.baserow.io/api/database/rows/table/";


const workerLoginForm =
    document.getElementById("workerLoginForm");

const workerLoginInput =
    document.getElementById("workerLogin");

const workerPasswordInput =
    document.getElementById("workerPassword");

const workerLoginMessage =
    document.getElementById("workerLoginMessage");

const workerLoginButton =
    document.getElementById("workerLoginButton");


function showWorkerMessage(
    text,
    type = "error"
) {

    workerLoginMessage.textContent = text;

    workerLoginMessage.className =
        `worker-login-message ${type}`;
}


async function getWorkers() {

    const response = await fetch(
        `${BASEROW_API}${WORKERS_TABLE_ID}/?user_field_names=true`,
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


workerLoginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const login =
            workerLoginInput.value.trim();

        const password =
            workerPasswordInput.value;


        if (!login || !password) {

            showWorkerMessage(
                "Введите логин и пароль."
            );

            return;
        }


        workerLoginButton.disabled = true;

        workerLoginButton.textContent =
            "Вход...";


        showWorkerMessage("");


        try {

            const data =
                await getWorkers();

            const workers =
                data.results || [];


            const worker =
                workers.find(function (row) {

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


                    const workerPassword =
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
                        password === workerPassword;


                    return (
                        loginMatches &&
                        passwordMatches
                    );
                });


            if (!worker) {

                showWorkerMessage(
                    "Неверный логин или пароль."
                );

                return;
            }


            const username =
                worker["username"] ??
                worker["Имя пользователя"] ??
                worker["user"] ??
                "Работник";


            const email =
                worker["email"] ??
                worker["Email"] ??
                "";


            const company =
                worker["company"] ??
                worker["Компания"] ??
                "";


            const position =
                worker["position"] ??
                worker["Должность"] ??
                "Работник";


            /*
             * Сохраняем данные работника
             */

            localStorage.setItem(
                "smartbin_worker_logged_in",
                "true"
            );


            localStorage.setItem(
                "smartbin_worker_id",
                String(worker.id)
            );


            localStorage.setItem(
                "smartbin_worker_username",
                username
            );


            localStorage.setItem(
                "smartbin_worker_email",
                email
            );


            localStorage.setItem(
                "smartbin_worker_company",
                company
            );


            localStorage.setItem(
                "smartbin_worker_position",
                position
            );


            showWorkerMessage(
                "Вход выполнен. Перенаправление...",
                "success"
            );


            setTimeout(function () {

                window.location.href =
                    "worker.html";

            }, 500);


        } catch (error) {

            console.error(error);


            showWorkerMessage(
                "Не удалось подключиться к Baserow."
            );

        } finally {

            workerLoginButton.disabled = false;

            workerLoginButton.textContent =
                "Войти";
        }
    }
);