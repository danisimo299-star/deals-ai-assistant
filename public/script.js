const demoButton = document.getElementById('demo-btn');
const demoInput = document.getElementById('demo-input');
const demoResponse = document.getElementById('demo-response');
const startButton = document.getElementById('start-btn');

if (demoButton) {
  demoButton.addEventListener('click', async () => {
    const message = demoInput.value.trim();

    if (!message) {
      demoResponse.textContent = 'Пожалуйста, введите сообщение.';
      return;
    }

    demoResponse.textContent = 'Отправка...';

    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      demoResponse.innerHTML = `
  <div class="assistant-message">
    <div class="assistant-label">AI Assistant</div>
    <div class="assistant-title">${data.title}</div>
    <div class="assistant-text">${data.reply}</div>
  </div>
`;


    } catch (error) {
      demoResponse.textContent = 'Произошла ошибка. Попробуйте еще раз.';
    }
  });
}

if (startButton) {
  startButton.addEventListener('click', () => {
    alert('Следующий этап: подключение реальных функций AI-ассистента.');
  });
}
