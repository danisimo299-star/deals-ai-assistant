const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const appDataPath = path.join(dataDir, 'app-data.json');
const chatHistoryPath = path.join(dataDir, 'chat-history.json');

function ensureFileExists(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
  }
}

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  ensureFileExists(appDataPath, {
    users: [],
    sessions: [],
    documents: [],
    activeDocuments: {}
  });

  ensureFileExists(chatHistoryPath, []);
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(`Ошибка чтения JSON ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getAppData() {
  ensureDataFiles();

  const data = readJson(appDataPath, {
    users: [],
    sessions: [],
    documents: [],
    activeDocuments: {}
  });

  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.documents)) data.documents = [];
  if (!data.activeDocuments || typeof data.activeDocuments !== 'object') {
    data.activeDocuments = {};
  }

  return data;
}

function saveAppData(data) {
  writeJson(appDataPath, data);
}

function getChatHistory() {
  ensureDataFiles();
  const history = readJson(chatHistoryPath, []);
  return Array.isArray(history) ? history : [];
}

function saveChatHistory(history) {
  writeJson(chatHistoryPath, history);
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createHistoryEntry(userId, role, text, extra = {}) {
  return {
    id: createId('msg'),
    userId,
    role,
    text,
    content: text,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function saveDocumentForUser(userId, fileData) {
  const appData = getAppData();

  const document = {
    id: createId('doc'),
    userId,
    originalName: fileData.originalName,
    storedName: fileData.storedName || fileData.originalName,
    type: fileData.type,
    mimeType: fileData.mimeType || '',
    text: fileData.text || '',
    summary: fileData.summary || '',
    uploadedAt: new Date().toISOString()
  };

  appData.documents.push(document);
  appData.activeDocuments[userId] = document.id;

  saveAppData(appData);

  return document;
}

function getDocumentsByUser(userId) {
  const appData = getAppData();

  return appData.documents
    .filter((doc) => doc.userId === userId)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function getDocumentById(documentId) {
  const appData = getAppData();
  return appData.documents.find((doc) => doc.id === documentId) || null;
}

function getUserDocumentById(userId, documentId) {
  const appData = getAppData();
  return (
    appData.documents.find(
      (doc) => doc.id === documentId && doc.userId === userId
    ) || null
  );
}

function setActiveDocumentForUser(userId, documentId) {
  const appData = getAppData();

  const document = appData.documents.find(
    (doc) => doc.id === documentId && doc.userId === userId
  );

  if (!document) {
    return null;
  }

  appData.activeDocuments[userId] = documentId;
  saveAppData(appData);

  return document;
}

function getActiveDocumentForUser(userId) {
  const appData = getAppData();
  const activeDocumentId = appData.activeDocuments[userId];

  if (!activeDocumentId) {
    return null;
  }

  return (
    appData.documents.find(
      (doc) => doc.id === activeDocumentId && doc.userId === userId
    ) || null
  );
}

function clearActiveDocumentForUser(userId) {
  const appData = getAppData();
  delete appData.activeDocuments[userId];
  saveAppData(appData);
}

function deleteDocumentForUser(userId, documentId) {
  const appData = getAppData();

  const documentIndex = appData.documents.findIndex(
    (doc) => doc.id === documentId && doc.userId === userId
  );

  if (documentIndex === -1) {
    return false;
  }

  appData.documents.splice(documentIndex, 1);

  if (appData.activeDocuments[userId] === documentId) {
    const remainingUserDocs = appData.documents
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    if (remainingUserDocs.length > 0) {
      appData.activeDocuments[userId] = remainingUserDocs[0].id;
    } else {
      delete appData.activeDocuments[userId];
    }
  }

  saveAppData(appData);
  return true;
}

function addChatMessage(entry) {
  const history = getChatHistory();
  history.push(entry);
  saveChatHistory(history);
  return entry;
}

function getHistoryByUser(userId) {
  const history = getChatHistory();
  return history.filter((item) => item.userId === userId);
}

function clearHistoryByUser(userId) {
  const history = getChatHistory();
  const filtered = history.filter((item) => item.userId !== userId);
  saveChatHistory(filtered);
}

function getHistoryStatsByUser(userId) {
  const userHistory = getHistoryByUser(userId);

  return {
    totalMessages: userHistory.length,
    userMessages: userHistory.filter((item) => item.role === 'user').length,
    assistantMessages: userHistory.filter((item) => item.role === 'assistant').length
  };
}

/*
  Совместимость со старым кодом
  Чтобы не ломался userService.js и старые участки проекта
*/

function readAppData() {
  return getAppData();
}

function readChatHistory() {
  return getChatHistory();
}

function addToChatHistory(userId, role, text, extra = {}) {
  return addChatMessage(createHistoryEntry(userId, role, text, extra));
}

function getUserChatHistory(userId) {
  return getHistoryByUser(userId);
}

function clearUserChatHistory(userId) {
  return clearHistoryByUser(userId);
}

module.exports = {
  // новые функции
  getAppData,
  saveAppData,
  getChatHistory,
  saveChatHistory,
  saveDocumentForUser,
  getDocumentsByUser,
  getDocumentById,
  getUserDocumentById,
  setActiveDocumentForUser,
  getActiveDocumentForUser,
  clearActiveDocumentForUser,
  deleteDocumentForUser,
  addChatMessage,
  getHistoryByUser,
  clearHistoryByUser,
  getHistoryStatsByUser,

  // старые имена для совместимости
  readAppData,
  readChatHistory,
  addToChatHistory,
  getUserChatHistory,
  clearUserChatHistory
};