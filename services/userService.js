const crypto = require('crypto');
const { readAppData, saveAppData } = require('./dataService');

function getAllUsers() {
  const data = readAppData();
  return Array.isArray(data.users) ? data.users : [];
}

function createUser(name, email, password) {
  const data = readAppData();

  if (!Array.isArray(data.users)) {
    data.users = [];
  }

  if (!Array.isArray(data.sessions)) {
    data.sessions = [];
  }

  const existingUser = data.users.find((user) => user.email === email);

  if (existingUser) {
    throw new Error('Пользователь с таким email уже существует.');
  }

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  saveAppData(data);

  return newUser;
}

function findUserByEmail(email) {
  const data = readAppData();

  if (!Array.isArray(data.users)) {
    return null;
  }

  return data.users.find((user) => user.email === email) || null;
}

function loginUser(email, password) {
  const data = readAppData();

  if (!Array.isArray(data.users)) {
    data.users = [];
  }

  if (!Array.isArray(data.sessions)) {
    data.sessions = [];
  }

  const user = data.users.find(
    (item) => item.email === email && item.password === password
  );

  if (!user) {
    throw new Error('Неверный email или пароль.');
  }

  data.sessions = [
    {
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString()
    }
  ];

  saveAppData(data);

  return user;
}

function getCurrentUser() {
  const data = readAppData();

  if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
    return null;
  }

  if (!Array.isArray(data.users) || data.users.length === 0) {
    return null;
  }

  const currentSession = data.sessions[0];

  if (!currentSession || !currentSession.userId) {
    return null;
  }

  const user = data.users.find((item) => item.id === currentSession.userId);

  return user || null;
}

function logoutUser() {
  const data = readAppData();
  data.sessions = [];
  saveAppData(data);
}

module.exports = {
  getAllUsers,
  createUser,
  findUserByEmail,
  loginUser,
  getCurrentUser,
  logoutUser
};