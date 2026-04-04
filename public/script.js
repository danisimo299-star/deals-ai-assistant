document.addEventListener('DOMContentLoaded', () => {
  const chatBox =
    document.getElementById('chat-box') ||
    document.getElementById('chatBox') ||
    document.querySelector('.chat-box');

  const messageInput =
    document.getElementById('messageInput') ||
    document.querySelector('input[placeholder*="Напишите сообщение"]');

  const sendButton =
    document.getElementById('sendButton') ||
    findButtonByText('Отправить');

  const clearChatButton =
    document.getElementById('clearChatBtn') ||
    findButtonByText('Очистить чат');

  const txtFileInput =
    document.getElementById('txtFile') ||
    document.getElementById('txtFileInput') ||
    document.querySelector('input[type="file"][data-type="txt"]') ||
    getAllFileInputs()[0];

  const pdfFileInput =
    document.getElementById('pdfFile') ||
    document.getElementById('pdfFileInput') ||
    document.querySelector('input[type="file"][data-type="pdf"]') ||
    getAllFileInputs()[1];

  const docxFileInput =
    document.getElementById('docxFile') ||
    document.getElementById('docxFileInput') ||
    document.querySelector('input[type="file"][data-type="docx"]') ||
    getAllFileInputs()[2];

  const uploadTxtButton =
    document.getElementById('uploadTxtBtn') ||
    findButtonByText('Загрузить TXT');

  const uploadPdfButton =
    document.getElementById('uploadPdfBtn') ||
    findButtonByText('Загрузить PDF');

  const uploadDocxButton =
    document.getElementById('uploadDocxBtn') ||
    findButtonByText('Загрузить DOCX');

  const clearFileButton =
    document.getElementById('clearFileBtn') ||
    findButtonByText('Очистить файл');

  const fileQuestionInput =
    document.getElementById('fileQuestionInput') ||
    document.querySelector('input[placeholder*="по последнему загруженному файлу"]');

  const askFileButton =
    document.getElementById('askFileBtn') ||
    findButtonByText('Спросить по файлу');

  const currentFileBox =
    document.getElementById('currentFileBox') ||
    document.getElementById('currentFileStatus') ||
    findElementContainingText('Текущий файл:');

  const exampleButtons = Array.from(document.querySelectorAll('button')).filter((btn) => {
    const text = normalize(btn.textContent);
    return ['ответ клиенту', 'краткий текст', 'объяснение'].includes(text);
  });

  const modeButtons = Array.from(document.querySelectorAll('button')).filter((btn) => {
    const text = normalize(btn.textContent);
    return ['ответ клиенту', 'кратко', 'объяснить просто', 'список шагов'].includes(text);
  });

  let selectedMode = null;

  function getAllFileInputs() {
    return Array.from(document.querySelectorAll('input[type="file"]'));
  }

  function normalize(text) {
    return (text || '').trim().toLowerCase();
  }

  function findButtonByText(text) {
    return Array.from(document.querySelectorAll('button')).find(
      (btn) => normalize(btn.textContent) === normalize(text)
    );
  }

  function findElementContainingText(text) {
    return Array.from(document.querySelectorAll('div, p, span')).find((el) =>
      (el.textContent || '').includes(text)
    );
  }

  function scrollChatToBottom() {
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function clearChatVisual() {
    if (!chatBox) return;
    chatBox.innerHTML = '';
  }

  function addMessage(sender, text) {
    if (!chatBox) return;

    const safeText = text && String(text).trim() ? String(text) : 'Пустой ответ.';
    const role = sender === 'user' ? 'user' : 'assistant';

    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-content';

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'ВЫ' : 'AI ASSISTANT';

    const content = document.createElement('div');
    content.className = 'message-text';
    content.textContent = safeText;

    bubble.appendChild(label);
    bubble.appendChild(content);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);

    scrollChatToBottom();
  }

  function setLoadingState(button, isLoading, loadingText = 'Загрузка...') {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.originalText;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const errorMessage =
        data?.reply ||
        data?.error ||
        data?.message ||
        'Произошла ошибка. Попробуйте еще раз.';
      throw new Error(errorMessage);
    }

    return data;
  }

  async function refreshCurrentFile() {
    if (!currentFileBox) return;

    try {
      const data = await fetchJson('/api/current-file');

      if (!data?.hasFile || !data.file) {
        currentFileBox.textContent = 'Текущий файл: не выбран';
        return;
      }

      const fileName = data.file.originalName || data.file.name || 'Без имени';
      currentFileBox.textContent = `Текущий файл: ${fileName}`;
    } catch (error) {
      currentFileBox.textContent = 'Текущий файл: ошибка загрузки';
    }
  }

  async function loadHistory() {
    if (!chatBox) return;

    try {
      const history = await fetchJson('/api/chat-history');

      if (!Array.isArray(history) || history.length === 0) {
        return;
      }

      clearChatVisual();

      history.forEach((item) => {
        const role = item.role === 'user' ? 'user' : 'assistant';
        const text = item.text || item.content || '';
        addMessage(role, text);
      });
    } catch (error) {
      // История не критична для запуска интерфейса
    }
  }

  async function sendChatMessage() {
    if (!messageInput) return;

    const message = messageInput.value.trim();

    if (!message) {
      addMessage('assistant', 'Введите сообщение.');
      return;
    }

    addMessage('user', message);
    messageInput.value = '';
    setLoadingState(sendButton, true, 'Отправка...');

    try {
      const data = await fetchJson('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      addMessage('assistant', data.reply || 'Ответ не получен.');
    } catch (error) {
      addMessage('assistant', error.message || 'Ошибка отправки сообщения.');
    } finally {
      setLoadingState(sendButton, false);
    }
  }

  async function uploadFile(input, url, typeLabel, button) {
    if (!input || !input.files || !input.files[0]) {
      addMessage('assistant', `Выберите ${typeLabel}-файл перед загрузкой.`);
      return;
    }

    const file = input.files[0];
    const formData = new FormData();

    formData.append('file', file);

    addMessage('user', `Загружен ${typeLabel}: ${file.name}`);
    addMessage('assistant', `${typeLabel}-файл загружается и анализируется...`);

    setLoadingState(button, true, 'Загрузка...');

    try {
      const data = await fetchJson(url, {
        method: 'POST',
        body: formData
      });

      addMessage('assistant', data.reply || data.analysis || 'Файл обработан.');
      input.value = '';
      await refreshCurrentFile();
    } catch (error) {
      addMessage('assistant', error.message || `Ошибка при загрузке ${typeLabel}.`);
    } finally {
      setLoadingState(button, false);
    }
  }

  async function clearChat() {
    setLoadingState(clearChatButton, true, 'Очистка...');

    try {
      const data = await fetchJson('/api/clear-chat', {
        method: 'POST'
      });

      clearChatVisual();
      addMessage('assistant', data.reply || 'Память чата очищена.');
    } catch (error) {
      addMessage('assistant', error.message || 'Не удалось очистить чат.');
    } finally {
      setLoadingState(clearChatButton, false);
    }
  }

  async function askAboutFile() {
    if (!fileQuestionInput) return;

    const question = fileQuestionInput.value.trim();

    if (!question) {
      addMessage('assistant', 'Введите вопрос по файлу.');
      return;
    }

    addMessage('user', question);
    fileQuestionInput.value = '';
    setLoadingState(askFileButton, true, 'Отправка...');

    try {
      const data = await fetchJson('/api/file-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });

      addMessage('assistant', data.reply || data.answer || 'Ответ не получен.');
    } catch (error) {
      addMessage('assistant', error.message || 'Ошибка вопроса по файлу.');
    } finally {
      setLoadingState(askFileButton, false);
    }
  }

  async function clearCurrentFile() {
    setLoadingState(clearFileButton, true, 'Очистка...');

    try {
      const data = await fetchJson('/api/clear-file', {
        method: 'POST'
      });

      addMessage('assistant', data.message || 'Активный файл очищен.');
      await refreshCurrentFile();
    } catch (error) {
      addMessage('assistant', error.message || 'Не удалось очистить файл.');
    } finally {
      setLoadingState(clearFileButton, false);
    }
  }

  async function runTaskMode(message, mode) {
    if (!message || !mode) return;

    addMessage('user', message);

    try {
      const data = await fetchJson('/api/task-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, mode })
      });

      addMessage('assistant', data.reply || 'Результат не получен.');
    } catch (error) {
      addMessage('assistant', error.message || 'Ошибка режима задачи.');
    }
  }

  function setMode(modeValue, button) {
    selectedMode = modeValue;

    modeButtons.forEach((btn) => btn.classList.remove('active'));
    if (button) {
      button.classList.add('active');
    }
  }

  if (sendButton) {
    sendButton.addEventListener('click', sendChatMessage);
  }

  if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }

  if (clearChatButton) {
    clearChatButton.addEventListener('click', clearChat);
  }

  if (uploadTxtButton) {
    uploadTxtButton.addEventListener('click', () => {
      uploadFile(txtFileInput, '/api/upload-txt', 'TXT', uploadTxtButton);
    });
  }

  if (uploadPdfButton) {
    uploadPdfButton.addEventListener('click', () => {
      uploadFile(pdfFileInput, '/api/upload-pdf', 'PDF', uploadPdfButton);
    });
  }

  if (uploadDocxButton) {
    uploadDocxButton.addEventListener('click', () => {
      uploadFile(docxFileInput, '/api/upload-docx', 'DOCX', uploadDocxButton);
    });
  }

  if (askFileButton) {
    askFileButton.addEventListener('click', askAboutFile);
  }

  if (clearFileButton) {
    clearFileButton.addEventListener('click', clearCurrentFile);
  }

  exampleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const text = normalize(button.textContent);

      if (!messageInput) return;

      if (text === 'ответ клиенту') {
        messageInput.value = 'Напиши вежливый ответ клиенту по поводу задержки заказа.';
      } else if (text === 'краткий текст') {
        messageInput.value = 'Сократи этот текст и оставь только главное.';
      } else if (text === 'объяснение') {
        messageInput.value = 'Объясни простыми словами, что такое unit-экономика.';
      }

      messageInput.focus();
    });
  });

  modeButtons.forEach((button) => {
    const text = normalize(button.textContent);

    let modeValue = null;

    if (text === 'ответ клиенту') modeValue = 'client-reply';
    if (text === 'кратко') modeValue = 'short';
    if (text === 'объяснить просто') modeValue = 'simple';
    if (text === 'список шагов') modeValue = 'steps';

    if (!modeValue) return;

    button.addEventListener('click', () => {
      setMode(modeValue, button);

      const currentMessage = messageInput?.value?.trim();
      if (currentMessage) {
        runTaskMode(currentMessage, modeValue);
        messageInput.value = '';
      }
    });
  });

  refreshCurrentFile();
  loadHistory();
});