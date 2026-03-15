const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/demo', (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      title: 'Ошибка',
      reply: 'Пожалуйста, введите текст.'
    });
  }

  const lowerMessage = message.toLowerCase();
  let reply = '';

  if (
    lowerMessage.includes('файл') ||
    lowerMessage.includes('pdf') ||
    lowerMessage.includes('doc')
  ) {
    reply =
      'AI-ассистент сможет помогать с файлами: анализировать документы, искать важную информацию и упрощать работу с данными.';
  } else if (
    lowerMessage.includes('клиент') ||
    lowerMessage.includes('заказ')
  ) {
    reply =
      'AI-ассистент сможет помогать в работе с клиентами: подсказывать ответы, ускорять обработку запросов и упрощать повседневные задачи.';
  } else if (
    lowerMessage.includes('документ') ||
    lowerMessage.includes('договор')
  ) {
    reply =
      'AI-ассистент сможет работать с документами: находить нужные пункты, помогать с анализом и делать работу быстрее.';
  } else {
    reply = `Демо-ответ: вы написали "${message}". Позже здесь будет подключен более умный AI-ассистент.`;
  }

  res.json({
    title: 'Ответ ассистента',
    reply
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
