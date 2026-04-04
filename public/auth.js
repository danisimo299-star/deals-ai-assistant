const registerCard = document.getElementById('register-card');
const loginCard = document.getElementById('login-card');

const registerNameInput = document.getElementById('register-name');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerButton = document.getElementById('register-btn');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginButton = document.getElementById('login-btn');

const currentUserBox = document.getElementById('current-user-box');
const logoutButton = document.getElementById('logout-btn');
const authStatusBox = document.getElementById('auth-status-box');

function showAuthStatus(message) {
  if (!authStatusBox) return;

  if (!message) {
    authStatusBox.style.display = 'none';
    authStatusBox.textContent = '';
    return;
  }

  authStatusBox.style.display = 'block';
  authStatusBox.textContent = message;
}

function setAuthCardsVisible(isVisible) {
  if (loginCard) {
    loginCard.style.display = isVisible ? 'flex' : 'none';
  }

  if (registerCard) {
    registerCard.style.display = isVisible ? 'flex' : 'none';
  }
}

async function loadCurrentUser() {
  if (!currentUserBox) return;

  try {
    const response = await fetch('/api/users/current');
    const data = await response.json();

    if (data.user) {
      currentUserBox.textContent = `${data.user.name} (${data.user.email})`;
      setAuthCardsVisible(false);
    } else {
      currentUserBox.textContent = 'Пользователь не вошел';
      setAuthCardsVisible(true);
    }
  } catch (error) {
    currentUserBox.textContent = 'Ошибка загрузки пользователя';
    setAuthCardsVisible(true);
  }
}

if (registerButton) {
  registerButton.addEventListener('click', async () => {
    const name = registerNameInput.value.trim();
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value.trim();

    if (!name || !email || !password) {
      showAuthStatus('Для регистрации заполните имя, email и пароль.');
      return;
    }

    try {
      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        showAuthStatus(data.error || 'Ошибка регистрации.');
        return;
      }

      showAuthStatus('');
      registerNameInput.value = '';
      registerEmailInput.value = '';
      registerPasswordInput.value = '';
      await loadCurrentUser();
    } catch (error) {
      showAuthStatus('Ошибка регистрации.');
    }
  });
}

if (loginButton) {
  loginButton.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
      showAuthStatus('Для входа укажите email и пароль.');
      return;
    }

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        showAuthStatus(data.error || 'Ошибка входа.');
        return;
      }

      showAuthStatus('');
      loginEmailInput.value = '';
      loginPasswordInput.value = '';
      await loadCurrentUser();

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 300);
    } catch (error) {
      showAuthStatus('Ошибка входа.');
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/users/logout', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        showAuthStatus(data.error || 'Ошибка выхода.');
        return;
      }

      showAuthStatus('');
      await loadCurrentUser();
    } catch (error) {
      showAuthStatus('Ошибка выхода.');
    }
  });
}

showAuthStatus('');
loadCurrentUser();