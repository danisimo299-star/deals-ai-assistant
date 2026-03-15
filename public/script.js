const demoButton = document.getElementById('demo-btn');
const demoInput = document.getElementById('demo-input');
const chatBox = document.getElementById('chat-box');
const clearChatButton = document.getElementById('clear-chat-btn');
const startButton = document.getElementById('start-btn');
const exampleButtons = document.querySelectorAll('.example-btn');
const uploadButton = document.getElementById('upload-btn');
const txtFileInput = document.getElementById('txt-file-input');
const uploadPdfButton = document.getElementById('upload-pdf-btn');
const pdfFileInput = document.getElementById('pdf-file-input');
const uploadDocxButton = document.getElementById('upload-docx-btn');
const docxFileInput = document.getElementById('docx-file-input');
const fileQuestionInput = document.getElementById('file-question-input');
const fileQuestionButton = document.getElementById('file-question-btn');
const taskButtons = document.querySelectorAll('.task-btn');
const currentFileText = document.getElementById('current-file-text');
const clearFileButton = document.getElementById('clear-file-btn');



function addMessage(role, label, text) {
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;

  message.innerHTML = `
    <div class="message-label">${label}</div>
    <div class="message-text">${text}</div>
  `;

  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

if (demoButton) {
  demoButton.addEventListener('click', async () => {
    const message = demoInput.value.trim();

    if (!message) {
      return;
    }

    addMessage('user', 'Вы', message);
    demoInput.value = '';

    async function loadCurrentFileInfo() {
  try {
    const response = await fetch('/api/current-file');
    const data = await response.json();

    if (data.hasFile && data.fileName) {
      currentFileText.textContent = `Текущий файл: ${data.fileName}`;
    } else {
      currentFileText.textContent = 'Текущий файл: не выбран';
    }
  } catch (error) {
    currentFileText.textContent = 'Текущий файл: ошибка загрузки';
  }
}


    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Произошла ошибка. Попробуйте еще раз.');
    }
  });
}
if (demoInput) {
  demoInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      demoButton.click();
    }
  });
}


exampleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const text = button.getAttribute('data-text');
    demoInput.value = text;
    demoInput.focus();
  });
});

taskButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const mode = button.getAttribute('data-mode');
    const message = demoInput.value.trim();

    if (!message) {
      addMessage('assistant', 'AI Assistant', 'Сначала введите текст для выбранного режима задачи.');
      return;
    }

    addMessage('user', 'Вы', `Режим задачи: ${button.textContent} | Текст: ${message}`);
    demoInput.value = '';

    try {
      const response = await fetch('/api/task-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, mode })
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Ошибка при выполнении режима задачи.');
    }
  });
});


if (uploadButton) {
  uploadButton.addEventListener('click', async () => {
    const file = txtFileInput.files[0];

    if (!file) {
      addMessage('assistant', 'AI Assistant', 'Пожалуйста, выберите TXT-файл.');
      return;
    }

    const formData = new FormData();
    formData.append('textfile', file);

    addMessage('user', 'Вы', `Загружен файл: ${file.name}`);
    addMessage('assistant', 'AI Assistant', 'Файл загружается и анализируется...');

    try {
      const response = await fetch('/api/upload-txt', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Ошибка при загрузке файла.');
    }
  });
}

if (fileQuestionButton) {
  fileQuestionButton.addEventListener('click', async () => {
    const question = fileQuestionInput.value.trim();

    if (!question) {
      addMessage('assistant', 'AI Assistant', 'Введите вопрос по файлу.');
      return;
    }

    addMessage('user', 'Вы', `Вопрос по файлу: ${question}`);
    fileQuestionInput.value = '';

    try {
      const response = await fetch('/api/file-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Ошибка при вопросе по файлу.');
    }
  });
}

if (uploadPdfButton) {
  uploadPdfButton.addEventListener('click', async () => {
    const file = pdfFileInput.files[0];

    if (!file) {
      addMessage('assistant', 'AI Assistant', 'Пожалуйста, выберите PDF-файл.');
      return;
    }

if (uploadDocxButton) {
  uploadDocxButton.addEventListener('click', async () => {
    const file = docxFileInput.files[0];

    if (!file) {
      addMessage('assistant', 'AI Assistant', 'Пожалуйста, выберите DOCX-файл.');
      return;
    }

    const formData = new FormData();
    formData.append('docxfile', file);

    addMessage('user', 'Вы', `Загружен DOCX: ${file.name}`);
    addMessage('assistant', 'AI Assistant', 'DOCX загружается и анализируется...');

    try {
      const response = await fetch('/api/upload-docx', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Ошибка при загрузке DOCX.');
    }
  });
}


    const formData = new FormData();
    formData.append('pdffile', file);

    addMessage('user', 'Вы', `Загружен PDF: ${file.name}`);
    addMessage('assistant', 'AI Assistant', 'PDF загружается и анализируется...');

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Ошибка при загрузке PDF.');
    }
  });
}

if (clearChatButton) {
  clearChatButton.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/clear-chat', {
        method: 'POST'
      });

      const data = await response.json();

      chatBox.innerHTML = `
        <div class="chat-message assistant">
          <div class="message-label">AI Assistant</div>
          <div class="message-text">Привет! Я готов помочь с задачами, текстами и рабочими вопросами.</div>
        </div>
      `;

      addMessage('assistant', 'AI Assistant', data.reply);
    } catch (error) {
      addMessage('assistant', 'AI Assistant', 'Не удалось очистить чат.');
    }
  });
}


if (startButton) {
  startButton.addEventListener('click', () => {
    alert('Следующий этап: загрузка файлов и работа с документами.');
  });
}
