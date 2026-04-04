require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const {
  saveDocumentForUser,
  getDocumentsByUser,
  setActiveDocumentForUser,
  getActiveDocumentForUser,
  clearActiveDocumentForUser,
  deleteDocumentForUser,
  addChatMessage,
  getHistoryByUser,
  clearHistoryByUser,
  getHistoryStatsByUser
} = require('./services/dataService');

const {
  getAllUsers,
  createUser,
  loginUser,
  getCurrentUser,
  logoutUser
} = require('./services/userService');

const app = express();
const PORT = process.env.PORT || 3000;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;

const SYSTEM_PROMPT =
  'Ты полезный AI-ассистент для малого бизнеса. Помогай с задачами, текстами, клиентскими сообщениями, документами и рабочими вопросами. Отвечай понятно и по делу.';

const GIGACHAT_TIMEOUT_MS = 20000;
const userChatMemories = {};

let gigachatTokenCache = {
  accessToken: null,
  expiresAt: 0
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage()
});

function getUploadedFileFromRequest(req) {
  if (req.file) {
    return req.file;
  }

  if (Array.isArray(req.files) && req.files.length > 0) {
    return req.files[0];
  }

  if (req.files && typeof req.files === 'object') {
    const firstKey = Object.keys(req.files)[0];

    if (firstKey && Array.isArray(req.files[firstKey]) && req.files[firstKey][0]) {
      return req.files[firstKey][0];
    }
  }

  return null;
}

function createMessageId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createHistoryEntry(userId, role, text, extra = {}) {
  return {
    id: createMessageId(),
    userId,
    role,
    text,
    content: text,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function getInitialChatMemory() {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    }
  ];
}

function getUserChatMemory(userId) {
  if (!userChatMemories[userId]) {
    userChatMemories[userId] = getInitialChatMemory();
  }

  return userChatMemories[userId];
}

function clearUserChatMemoryState(userId) {
  userChatMemories[userId] = getInitialChatMemory();
}

function requireAuth(req, res, next) {
  const user = getCurrentUser();

  if (!user) {
    return res.status(401).json({
      error: 'Сначала войдите в аккаунт.'
    });
  }

  req.user = user;
  next();
}

async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GIGACHAT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Превышено время ожидания ответа от GigaChat.');
      timeoutError.code = 'GIGACHAT_TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFriendlyGigaChatError(error, fallbackMessage = 'Не удалось получить ответ от GigaChat.') {
  if (!error) {
    return fallbackMessage;
  }

  if (error.code === 'GIGACHAT_TIMEOUT') {
    return 'GigaChat слишком долго отвечает. Попробуй еще раз через пару секунд.';
  }

  if (error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || error?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return 'Не удалось подключиться к GigaChat. Проверь интернет, VPN, firewall или попробуй позже.';
  }

  if (error?.cause?.code === 'ECONNRESET' || error?.code === 'ECONNRESET') {
    return 'Соединение с GigaChat было сброшено. Попробуй еще раз.';
  }

  if (error.message?.includes('GIGACHAT_AUTH_KEY')) {
    return 'Не найден GIGACHAT_AUTH_KEY. Проверь файл .env.';
  }

  if (error.message?.includes('Ошибка получения токена GigaChat')) {
    return 'Не удалось получить токен GigaChat. Проверь ключ доступа и сеть.';
  }

  if (error.message?.includes('Ошибка запроса к GigaChat')) {
    return 'GigaChat вернул ошибку при обработке запроса.';
  }

  return fallbackMessage;
}

async function getGigaChatAccessToken() {
  if (!GIGACHAT_AUTH_KEY) {
    throw new Error('GIGACHAT_AUTH_KEY не найден в .env или переменных окружения');
  }

  const now = Date.now();

  if (gigachatTokenCache.accessToken && gigachatTokenCache.expiresAt > now + 15000) {
    return gigachatTokenCache.accessToken;
  }

  const rqUID = crypto.randomUUID();

  const response = await safeFetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      RqUID: rqUID,
      Authorization: `Basic ${GIGACHAT_AUTH_KEY}`
    },
    body: new URLSearchParams({
      scope: 'GIGACHAT_API_PERS'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка получения токена GigaChat: ${errorText}`);
  }

  const data = await response.json();

  gigachatTokenCache.accessToken = data.access_token;

  if (data.expires_at) {
    const expiresAt = Number(data.expires_at);
    gigachatTokenCache.expiresAt = Number.isFinite(expiresAt)
      ? expiresAt
      : Date.now() + 25 * 60 * 1000;
  } else {
    gigachatTokenCache.expiresAt = Date.now() + 25 * 60 * 1000;
  }

  return data.access_token;
}

async function requestGigaChat(messages, errorPrefix = 'Ошибка запроса к GigaChat') {
  const accessToken = await getGigaChatAccessToken();

  const response = await safeFetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${errorPrefix}: ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'GigaChat не вернул текст ответа.';
}

async function getGigaChatReply(userId, userMessage) {
  const chatMemory = getUserChatMemory(userId);

  chatMemory.push({
    role: 'user',
    content: userMessage
  });

  addChatMessage(createHistoryEntry(userId, 'user', userMessage));

  if (chatMemory.length > 11) {
    userChatMemories[userId] = [chatMemory[0], ...chatMemory.slice(-10)];
  }

  const assistantReply = await requestGigaChat(
    userChatMemories[userId],
    'Ошибка запроса к GigaChat'
  );

  userChatMemories[userId].push({
    role: 'assistant',
    content: assistantReply
  });

  addChatMessage(createHistoryEntry(userId, 'assistant', assistantReply));

  if (userChatMemories[userId].length > 11) {
    userChatMemories[userId] = [userChatMemories[userId][0], ...userChatMemories[userId].slice(-10)];
  }

  return assistantReply;
}

async function summarizeTextFile(fileText) {
  return requestGigaChat(
    [
      {
        role: 'system',
        content:
          'Ты AI-ассистент для малого бизнеса. Прочитай текст файла и сделай короткое, понятное резюме на русском языке.'
      },
      {
        role: 'user',
        content: `Вот содержимое файла:\n\n${fileText}`
      }
    ],
    'Ошибка анализа TXT в GigaChat'
  );
}

async function summarizePdfText(fileText) {
  return requestGigaChat(
    [
      {
        role: 'system',
        content:
          'Ты AI-ассистент для малого бизнеса. Прочитай текст PDF-документа и сделай короткое, понятное резюме на русском языке. Выдели главное.'
      },
      {
        role: 'user',
        content: `Вот текст из PDF:\n\n${fileText}`
      }
    ],
    'Ошибка анализа PDF в GigaChat'
  );
}

async function summarizeDocxText(fileText) {
  return requestGigaChat(
    [
      {
        role: 'system',
        content:
          'Ты AI-ассистент для малого бизнеса. Прочитай текст DOCX-документа и сделай короткое, понятное резюме на русском языке. Выдели главное.'
      },
      {
        role: 'user',
        content: `Вот текст из DOCX:\n\n${fileText}`
      }
    ],
    'Ошибка анализа DOCX в GigaChat'
  );
}

async function answerQuestionAboutFile(fileText, userQuestion) {
  return requestGigaChat(
    [
      {
        role: 'system',
        content:
          'Ты AI-ассистент для малого бизнеса. Отвечай только по содержимому загруженного файла. Если в тексте файла нет ответа, честно скажи, что в файле это не найдено.'
      },
      {
        role: 'user',
        content: `Вот текст файла:\n\n${fileText}\n\nВопрос пользователя: ${userQuestion}`
      }
    ],
    'Ошибка вопроса по файлу в GigaChat'
  );
}

async function getTaskModeReply(userMessage, mode) {
  let systemPrompt = 'Ты полезный AI-ассистент для малого бизнеса. Отвечай понятно и по делу.';

  if (mode === 'client-reply') {
    systemPrompt =
      'Ты AI-ассистент для малого бизнеса. Напиши вежливый и деловой ответ клиенту на русском языке.';
  } else if (mode === 'short') {
    systemPrompt =
      'Ты AI-ассистент для малого бизнеса. Сократи текст или задачу и дай краткий, понятный ответ на русском языке.';
  } else if (mode === 'simple') {
    systemPrompt =
      'Ты AI-ассистент для малого бизнеса. Объясняй всё очень простыми словами, коротко и понятно, на русском языке.';
  } else if (mode === 'steps') {
    systemPrompt =
      'Ты AI-ассистент для малого бизнеса. Преобразуй запрос в понятный список шагов на русском языке.';
  }

  return requestGigaChat(
    [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ],
    'Ошибка режима задачи в GigaChat'
  );
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/demo', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Пожалуйста, введите текст.'
      });
    }

    const reply = await getGigaChatReply(req.user.id, message.trim());

    res.json({
      title: 'Ответ ассистента',
      reply
    });
  } catch (error) {
    console.error('GigaChat chat error:', error);
    console.error('GigaChat chat error cause:', error.cause);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Не удалось получить ответ от GigaChat.')
    });
  }
});

app.get('/api/gigachat-test', async (req, res) => {
  try {
    const token = await getGigaChatAccessToken();

    res.json({
      message: 'Токен GigaChat получен успешно',
      tokenPreview: `${token.slice(0, 20)}...`
    });
  } catch (error) {
    console.error('GigaChat token error:', error);
    console.error('GigaChat token error cause:', error.cause);

    res.status(500).json({
      message: 'Не удалось получить токен GigaChat',
      error: getFriendlyGigaChatError(error, error.message),
      cause: error.cause ? String(error.cause) : 'no cause'
    });
  }
});

app.post('/api/upload-txt', requireAuth, upload.any(), async (req, res) => {
  try {
    const uploadedFile = getUploadedFileFromRequest(req);

    if (!uploadedFile) {
      return res.status(400).json({ error: 'Файл не загружен.' });
    }

    const fileText = uploadedFile.buffer.toString('utf-8');
    const summary = await summarizeTextFile(fileText);

    const savedDocument = saveDocumentForUser(req.user.id, {
      originalName: uploadedFile.originalname,
      storedName: uploadedFile.originalname,
      type: 'txt',
      mimeType: uploadedFile.mimetype,
      text: fileText,
      summary
    });

    addChatMessage(
      createHistoryEntry(
        req.user.id,
        'assistant',
        `[Загружен TXT: ${uploadedFile.originalname}] ${summary}`
      )
    );

    res.json({
      title: 'Анализ TXT',
      message: 'TXT-файл загружен и сохранен.',
      reply: summary,
      analysis: summary,
      document: savedDocument
    });
  } catch (error) {
    console.error('TXT upload error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Ошибка загрузки TXT-файла.')
    });
  }
});

app.post('/api/upload-pdf', requireAuth, upload.any(), async (req, res) => {
  try {
    const uploadedFile = getUploadedFileFromRequest(req);

    if (!uploadedFile) {
      return res.status(400).json({ error: 'Файл не загружен.' });
    }

    const pdfData = await pdfParse(uploadedFile.buffer);
    const fileText = pdfData.text || '';
    const summary = await summarizePdfText(fileText);

    const savedDocument = saveDocumentForUser(req.user.id, {
      originalName: uploadedFile.originalname,
      storedName: uploadedFile.originalname,
      type: 'pdf',
      mimeType: uploadedFile.mimetype,
      text: fileText,
      summary
    });

    addChatMessage(
      createHistoryEntry(
        req.user.id,
        'assistant',
        `[Загружен PDF: ${uploadedFile.originalname}] ${summary}`
      )
    );

    res.json({
      title: 'Анализ PDF',
      message: 'PDF-файл загружен и сохранен.',
      reply: summary,
      analysis: summary,
      document: savedDocument
    });
  } catch (error) {
    console.error('PDF upload error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Ошибка загрузки PDF-файла.')
    });
  }
});

app.post('/api/upload-docx', requireAuth, upload.any(), async (req, res) => {
  try {
    const uploadedFile = getUploadedFileFromRequest(req);

    if (!uploadedFile) {
      return res.status(400).json({ error: 'Файл не загружен.' });
    }

    const result = await mammoth.extractRawText({ buffer: uploadedFile.buffer });
    const fileText = result.value || '';
    const summary = await summarizeDocxText(fileText);

    const savedDocument = saveDocumentForUser(req.user.id, {
      originalName: uploadedFile.originalname,
      storedName: uploadedFile.originalname,
      type: 'docx',
      mimeType: uploadedFile.mimetype,
      text: fileText,
      summary
    });

    addChatMessage(
      createHistoryEntry(
        req.user.id,
        'assistant',
        `[Загружен DOCX: ${uploadedFile.originalname}] ${summary}`
      )
    );

    res.json({
      title: 'Анализ DOCX',
      message: 'DOCX-файл загружен и сохранен.',
      reply: summary,
      analysis: summary,
      document: savedDocument
    });
  } catch (error) {
    console.error('DOCX upload error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Ошибка загрузки DOCX-файла.')
    });
  }
});

app.post('/api/file-question', requireAuth, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Введите вопрос по файлу.'
      });
    }

    const activeDocument = getActiveDocumentForUser(req.user.id);

    if (!activeDocument || !activeDocument.text) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'У вас нет активного документа.'
      });
    }

    const cleanQuestion = question.trim();
    const answer = await answerQuestionAboutFile(activeDocument.text, cleanQuestion);

    addChatMessage(
      createHistoryEntry(
        req.user.id,
        'user',
        `[Вопрос по файлу: ${activeDocument.originalName}] ${cleanQuestion}`
      )
    );

    addChatMessage(createHistoryEntry(req.user.id, 'assistant', answer));

    res.json({
      title: 'Ответ по файлу',
      reply: answer,
      answer,
      document: {
        id: activeDocument.id,
        originalName: activeDocument.originalName,
        type: activeDocument.type
      }
    });
  } catch (error) {
    console.error('File question error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Ошибка при ответе по файлу.')
    });
  }
});

app.post('/api/task-mode', requireAuth, async (req, res) => {
  try {
    const { message, mode } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Введите текст для задачи.'
      });
    }

    if (!mode) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Режим задачи не выбран.'
      });
    }

    const cleanMessage = message.trim();
    const reply = await getTaskModeReply(cleanMessage, mode);

    addChatMessage(
      createHistoryEntry(req.user.id, 'user', `[Режим: ${mode}] ${cleanMessage}`)
    );

    addChatMessage(
      createHistoryEntry(req.user.id, 'assistant', reply)
    );

    res.json({
      title: 'Результат задачи',
      reply
    });
  } catch (error) {
    console.error('Task mode error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: getFriendlyGigaChatError(error, 'Не удалось выполнить задачу.')
    });
  }
});

app.post('/api/clear-chat', requireAuth, (req, res) => {
  clearUserChatMemoryState(req.user.id);

  res.json({
    title: 'Чат очищен',
    reply: 'Память чата очищена.'
  });
});

app.get('/api/current-file', requireAuth, (req, res) => {
  try {
    const activeDocument = getActiveDocumentForUser(req.user.id);

    if (!activeDocument) {
      return res.json({
        hasFile: false,
        file: null
      });
    }

    res.json({
      hasFile: true,
      file: {
        id: activeDocument.id,
        name: activeDocument.originalName,
        originalName: activeDocument.originalName,
        type: activeDocument.type,
        summary: activeDocument.summary,
        uploadedAt: activeDocument.uploadedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка получения текущего файла.'
    });
  }
});

app.post('/api/clear-file', requireAuth, (req, res) => {
  try {
    clearActiveDocumentForUser(req.user.id);

    res.json({
      message: 'Активный документ очищен.'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка очистки активного документа.'
    });
  }
});

app.get('/api/chat-history', requireAuth, (req, res) => {
  try {
    const history = getHistoryByUser(req.user.id).map((item) => ({
      ...item,
      text: item.text || item.content || '',
      content: item.content || item.text || ''
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка получения истории.'
    });
  }
});

app.post('/api/clear-history', requireAuth, (req, res) => {
  try {
    clearHistoryByUser(req.user.id);

    res.json({
      title: 'История очищена',
      reply: 'История запросов очищена.'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка очистки истории.'
    });
  }
});

app.get('/api/history-stats', requireAuth, (req, res) => {
  try {
    const history = getHistoryByUser(req.user.id).map((item) => ({
      ...item,
      text: item.text || item.content || ''
    }));

    const baseStats = getHistoryStatsByUser(req.user.id);

    const uploadedFiles = history.filter((item) => item.text.startsWith('[Загружен')).length;
    const fileQuestions = history.filter((item) => item.text.startsWith('[Вопрос по файлу')).length;
    const taskModes = history.filter((item) => item.text.startsWith('[Режим:')).length;

    res.json({
      total: baseStats.totalMessages,
      totalMessages: baseStats.totalMessages,
      userMessages: baseStats.userMessages,
      assistantMessages: baseStats.assistantMessages,
      uploadedFiles,
      fileQuestions,
      taskModes
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка получения статистики.'
    });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = getAllUsers().map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    }));

    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Не удалось получить список пользователей.'
    });
  }
});

app.post('/api/users/register', (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Нужно указать имя, email и пароль.'
      });
    }

    const user = createUser(name.trim(), email.trim().toLowerCase(), password.trim());

    res.json({
      message: 'Пользователь создан',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || 'Не удалось создать пользователя.'
    });
  }
});

app.post('/api/users/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Нужно указать email и пароль.'
      });
    }

    const user = loginUser(email.trim().toLowerCase(), password.trim());

    clearUserChatMemoryState(user.id);

    res.json({
      message: 'Вход выполнен',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || 'Не удалось выполнить вход.'
    });
  }
});

app.get('/api/users/current', (req, res) => {
  try {
    const user = getCurrentUser();

    if (!user) {
      return res.json({
        user: null
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Не удалось получить текущего пользователя.'
    });
  }
});

app.get('/api/documents', requireAuth, (req, res) => {
  try {
    const documents = getDocumentsByUser(req.user.id);
    const activeDocument = getActiveDocumentForUser(req.user.id);

    res.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        name: doc.originalName,
        originalName: doc.originalName,
        type: doc.type,
        summary: doc.summary,
        uploadedAt: doc.uploadedAt,
        isActive: activeDocument ? doc.id === activeDocument.id : false
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка получения списка документов.'
    });
  }
});

app.post('/api/documents/select', requireAuth, (req, res) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'documentId обязателен.' });
    }

    const selectedDocument = setActiveDocumentForUser(req.user.id, documentId);

    if (!selectedDocument) {
      return res.status(404).json({ error: 'Документ не найден.' });
    }

    res.json({
      message: 'Активный документ выбран.',
      document: {
        id: selectedDocument.id,
        name: selectedDocument.originalName,
        originalName: selectedDocument.originalName,
        type: selectedDocument.type,
        summary: selectedDocument.summary,
        uploadedAt: selectedDocument.uploadedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка выбора активного документа.'
    });
  }
});

app.get('/api/documents/active', requireAuth, (req, res) => {
  try {
    const activeDocument = getActiveDocumentForUser(req.user.id);

    if (!activeDocument) {
      return res.json({ document: null });
    }

    res.json({
      document: {
        id: activeDocument.id,
        name: activeDocument.originalName,
        originalName: activeDocument.originalName,
        type: activeDocument.type,
        summary: activeDocument.summary,
        uploadedAt: activeDocument.uploadedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка получения активного документа.'
    });
  }
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  try {
    const isDeleted = deleteDocumentForUser(req.user.id, req.params.id);

    if (!isDeleted) {
      return res.status(404).json({ error: 'Документ не найден.' });
    }

    res.json({
      message: 'Документ удален.'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Ошибка удаления документа.'
    });
  }
});

app.post('/api/users/logout', (req, res) => {
  try {
    const user = getCurrentUser();

    if (user) {
      delete userChatMemories[user.id];
    }

    logoutUser();

    res.json({
      message: 'Выход выполнен'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Не удалось выполнить выход.'
    });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: `Multer error: ${err.message}`
    });
  }

  if (err) {
    console.error('Unhandled server error:', err);

    return res.status(500).json({
      error: err.message || 'Внутренняя ошибка сервера.'
    });
  }

  next();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});