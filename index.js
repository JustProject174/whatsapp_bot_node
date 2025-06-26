require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN_INSTANCE;

const BASE_URL = `https://1103.api.green-api.com/waInstance${ID_INSTANCE}`;

const sendMessage = async (chatId, text) => {
  try {
    const response = await axios.post(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
      chatId,
      message: text,
    });
    console.log('Сообщение отправлено:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error.response?.data || error.message);
    throw error;
  }
};

const sendButtons = async (chatId, message, buttons) => {
  try {
    const formattedButtons = buttons.map((text, index) => ({
      buttonId: `btn_${index + 1}`,
      buttonText: { displayText: text },
      type: 1,
    }));

    const response = await axios.post(`${BASE_URL}/sendButtons/${API_TOKEN}`, {
      chatId,
      message,
      buttons: formattedButtons,
    });
    console.log('Кнопки отправлены:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка отправки кнопок:', error.response?.data || error.message);
    throw error;
  }
};

// Добавляем GET endpoint для проверки
app.get('/', (req, res) => {
  console.log('GET запрос на главную страницу');
  res.json({ 
    status: 'OK', 
    message: 'WhatsApp Bot работает',
    timestamp: new Date().toISOString()
  });
});

// Добавляем GET endpoint для webhook (для проверки)
app.get('/webhook', (req, res) => {
  console.log('GET запрос на /webhook');
  res.json({ 
    status: 'Webhook endpoint активен',
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook', async (req, res) => {
  console.log('🔔 Получен POST запрос на /webhook');
  console.log('Полное тело запроса:', JSON.stringify(req.body, null, 2));
  
  try {
    const body = req.body;
    
    // Более детальная проверка структуры webhook
    let chatId = null;
    let messageText = null;
    let webhookType = null;
    
    // Проверяем разные типы webhook от Green API
    if (body?.body?.senderData?.chatId) {
      chatId = body.body.senderData.chatId;
      webhookType = 'senderData';
    } else if (body?.senderData?.chatId) {
      chatId = body.senderData.chatId;
      webhookType = 'direct senderData';
    } else if (body?.body?.chatId) {
      chatId = body.body.chatId;
      webhookType = 'body chatId';
    } else if (body?.chatId) {
      chatId = body.chatId;
      webhookType = 'direct chatId';
    }
    
    // Извлекаем текст сообщения
    if (body?.body?.messageData?.textMessageData?.textMessage) {
      messageText = body.body.messageData.textMessageData.textMessage;
    } else if (body?.messageData?.textMessageData?.textMessage) {
      messageText = body.messageData.textMessageData.textMessage;
    }
    
    console.log('Извлеченные данные:');
    console.log('- Chat ID:', chatId);
    console.log('- Message Text:', messageText);
    console.log('- Webhook Type:', webhookType);
    console.log('- Тип webhook:', body?.typeWebhook);
    
    if (chatId) {
      console.log('✅ Найден Chat ID, отправляем ответ...');
      
      await sendMessage(chatId, 'ЗДЕСЬ БУДЕТ ПРИВЕТСТВЕННЫЙ ТЕКСТ');
      
      await sendButtons(chatId, 'Выберите вариант 1:', ['Кнопка 1', 'Кнопка 2', 'Кнопка 3']);
      await sendButtons(chatId, 'Выберите вариант 2:', ['Кнопка 4', 'Кнопка 5', 'Кнопка 6']);
      await sendMessage(chatId, 'Кнопка 7');
      
      console.log('✅ Все сообщения отправлены успешно');
    } else {
      console.log('❌ Chat ID не найден в webhook данных');
    }

    res.status(200).json({ 
      success: true, 
      message: 'Webhook обработан',
      chatId: chatId,
      webhookType: webhookType
    });
    
  } catch (err) {
    console.error('❌ Ошибка в webhook:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Сервер запущен на порту ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log('📋 Переменные окружения:');
  console.log('- ID_INSTANCE:', ID_INSTANCE ? '✅ Установлен' : '❌ Не установлен');
  console.log('- API_TOKEN:', API_TOKEN ? '✅ Установлен' : '❌ Не установлен');
});