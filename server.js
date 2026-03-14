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
      reply: 'Пожалуйста, введите текст.'
    });
  }

  res.json({
    reply: `Вы написали: "${message}". Позже здесь будет настоящий AI-ответ.`
  });
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
