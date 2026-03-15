require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');




const app = express();
const PORT = process.env.PORT || 3000;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
let lastUploadedFileText = '';
let lastUploadedFileName = '';
let chatMemory = [
  {
    role: 'system',
    content:
      'Ты полезный AI-ассистент для малого бизнеса. Помогай с задачами, текстами, клиентскими сообщениями, документами и рабочими вопросами. Отвечай понятно и по делу.'
  }
];



app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ dest: 'uploads/' });
async function getGigaChatAccessToken() {
  if (!GIGACHAT_AUTH_KEY) {
    throw new Error('GIGACHAT_AUTH_KEY не найден в .env');
  }
async function getGigaChatReply(userMessage) {
  const accessToken = await getGigaChatAccessToken();

  chatMemory.push({
    role: 'user',
    content: userMessage
  });

  if (chatMemory.length > 11) {
    chatMemory = [chatMemory[0], ...chatMemory.slice(-10)];
  }

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: chatMemory
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка запроса к GigaChat: ${errorText}`);
  }

  const data = await response.json();
  const assistantReply = data.choices[0].message.content;

  chatMemory.push({
    role: 'assistant',
    content: assistantReply
  });

  if (chatMemory.length > 11) {
    chatMemory = [chatMemory[0], ...chatMemory.slice(-10)];
  }

  return assistantReply;
}


  async function summarizeTextFile(fileText) {
  const accessToken = await getGigaChatAccessToken();

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content:
            'Ты AI-ассистент для малого бизнеса. Прочитай текст файла и сделай короткое, понятное резюме на русском языке.'
        },
        {
          role: 'user',
          content: `Вот содержимое файла:\n\n${fileText}`
        }
      ]
    })
  });

  async function summarizePdfText(fileText) {
  const accessToken = await getGigaChatAccessToken();

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content:
            'Ты AI-ассистент для малого бизнеса. Прочитай текст PDF-документа и сделай короткое, понятное резюме на русском языке. Выдели главное.'
        },
        {
          role: 'user',
          content: `Вот текст из PDF:\n\n${fileText}`
        }
      ]
    })
  });

  async function summarizeDocxText(fileText) {
  const accessToken = await getGigaChatAccessToken();

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content:
            'Ты AI-ассистент для малого бизнеса. Прочитай текст DOCX-документа и сделай короткое, понятное резюме на русском языке. Выдели главное.'
        },
        {
          role: 'user',
          content: `Вот текст из DOCX:\n\n${fileText}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка анализа DOCX в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}


  async function answerQuestionAboutFile(fileText, userQuestion) {
  const accessToken = await getGigaChatAccessToken();

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content:
            'Ты AI-ассистент для малого бизнеса. Отвечай только по содержимому загруженного файла. Если в тексте файла нет ответа, честно скажи, что в файле это не найдено.'
        },
        {
          role: 'user',
          content: `Вот текст файла:\n\n${fileText}\n\nВопрос пользователя: ${userQuestion}`
        }
      ]
    })
  });

  async function getTaskModeReply(userMessage, mode) {
  const accessToken = await getGigaChatAccessToken();

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

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка режима задачи в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}


  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка вопроса по файлу в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}


  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка анализа PDF в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getTaskModeReply(userMessage, mode) {
  const accessToken = await getGigaChatAccessToken();

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

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка режима задачи в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}



  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка анализа файла в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка запроса к GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}


  const rqUID = crypto.randomUUID();

  async function getGigaChatAccessToken() {
  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rqUID,
      'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`
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
  return data.access_token;
}

async function getGigaChatReply(userMessage) {
  const accessToken = await getGigaChatAccessToken();

  chatMemory.push({
    role: 'user',
    content: userMessage
  });

  if (chatMemory.length > 11) {
    chatMemory = [chatMemory[0], ...chatMemory.slice(-10)];
  }

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: chatMemory
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка запроса к GigaChat: ${errorText}`);
  }

  const data = await response.json();
  const assistantReply = data.choices[0].message.content;

  chatMemory.push({
    role: 'assistant',
    content: assistantReply
  });

  if (chatMemory.length > 11) {
    chatMemory = [chatMemory[0], ...chatMemory.slice(-10)];
  }

  return assistantReply;
}


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/demo', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Пожалуйста, введите текст.'
      });
    }

    const reply = await getGigaChatReply(message);

    res.json({
      title: 'Ответ ассистента',
      reply
    });
 } catch (error) {
  console.error('GigaChat chat error:', error);
  console.error('GigaChat chat error cause:', error.cause);

  res.status(500).json({
    title: 'Ошибка',
    reply: error.message || 'Не удалось получить ответ от GigaChat.'
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
    error: error.message,
    cause: error.cause ? String(error.cause) : 'no cause'
  });
}

});

app.post('/api/upload-txt', upload.single('textfile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Файл не был загружен.'
      });
    }

    const filePath = req.file.path;
    const fileText = fs.readFileSync(filePath, 'utf8');

    if (!fileText.trim()) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Файл пустой.'
      });
    }

    lastUploadedFileText = fileText;
    lastUploadedFileName = req.file.originalname;
    const reply = await summarizeTextFile(fileText);

    fs.unlinkSync(filePath);

    res.json({
      title: 'Анализ файла',
      reply
    });
  } catch (error) {
    console.error('File upload error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: error.message || 'Не удалось обработать файл.'
    });
  }
});

app.post('/api/upload-pdf', upload.single('pdffile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'PDF-файл не был загружен.'
      });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text || '';

    if (!pdfText.trim()) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Не удалось извлечь текст из PDF.'
      });
    }

    const shortPdfText = pdfText.slice(0, 12000);
    lastUploadedFileText = shortPdfText;
    lastUploadedFileName = req.file.originalname;
    const reply = await summarizePdfText(shortPdfText);

    fs.unlinkSync(filePath);

    res.json({
      title: 'Анализ PDF',
      reply
    });
  } catch (error) {
    console.error('PDF upload error:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      title: 'Ошибка',
      reply: error.message || 'Не удалось обработать PDF.'
    });
  }
});

app.post('/api/file-question', async (req, res) => {
  try {
    const { question } = req.body;

    if (!lastUploadedFileText) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Сначала загрузите TXT или PDF файл.'
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Введите вопрос по файлу.'
      });
    }

    const reply = await answerQuestionAboutFile(lastUploadedFileText, question);

    res.json({
      title: `Ответ по файлу: ${lastUploadedFileName}`,
      reply
    });
  } catch (error) {
    console.error('File question error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: error.message || 'Не удалось ответить по файлу.'
    });
  }
});

async function getTaskModeReply(userMessage, mode) {
  const accessToken = await getGigaChatAccessToken();

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

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка режима задачи в GigaChat: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}


app.post('/api/task-mode', async (req, res) => {
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

    const reply = await getTaskModeReply(message, mode);

    res.json({
      title: 'Результат задачи',
      reply
    });
  } catch (error) {
    console.error('Task mode error:', error);

    res.status(500).json({
      title: 'Ошибка',
      reply: error.message || 'Не удалось выполнить задачу.'
    });
  }
});

app.post('/api/clear-chat', (req, res) => {
  chatMemory = [
    {
      role: 'system',
      content:
        'Ты полезный AI-ассистент для малого бизнеса. Помогай с задачами, текстами, клиентскими сообщениями, документами и рабочими вопросами. Отвечай понятно и по делу.'
    }
  ];

  res.json({
    title: 'Чат очищен',
    reply: 'Память чата очищена.'
  });
});

app.post('/api/upload-docx', upload.single('docxfile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'DOCX-файл не был загружен.'
      });
    }

    const filePath = req.file.path;
    const result = await mammoth.extractRawText({ path: filePath });
    const docxText = result.value || '';

    if (!docxText.trim()) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        title: 'Ошибка',
        reply: 'Не удалось извлечь текст из DOCX.'
      });
    }

    const shortDocxText = docxText.slice(0, 12000);

    lastUploadedFileText = shortDocxText;
    lastUploadedFileName = req.file.originalname;

    const reply = await summarizeDocxText(shortDocxText);

    fs.unlinkSync(filePath);

    res.json({
      title: 'Анализ DOCX',
      reply
    });
  } catch (error) {
    console.error('DOCX upload error:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      title: 'Ошибка',
      reply: error.message || 'Не удалось обработать DOCX.'
    });
  }
});

app.get('/api/current-file', (req, res) => {
  res.json({
    fileName: lastUploadedFileName || '',
    hasFile: Boolean(lastUploadedFileText)
  });
});
app.post('/api/clear-file', (req, res) => {
  lastUploadedFileText = '';
  lastUploadedFileName = '';

  res.json({
    title: 'Файл очищен',
    reply: 'Контекст текущего файла очищен.'
  });
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
