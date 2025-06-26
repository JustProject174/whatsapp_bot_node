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

const BASE_URL = `https://${ID_INSTANCE}.api.green-api.com/waInstance${ID_INSTANCE}`;

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

// Endpoint для проверки настроек Green API
app.get('/test-api', async (req, res) => {
  try {
    console.log('🔍 Проверяем соединение с Green API...');
    
    // Проверяем настройки инстанса
    const settingsResponse = await axios.get(`${BASE_URL}/getSettings/${API_TOKEN}`);
    console.log('⚙️ Настройки инстанса:', settingsResponse.data);
    
    // Проверяем состояние инстанса
    const stateResponse = await axios.get(`${BASE_URL}/getStateInstance/${API_TOKEN}`);
    console.log('📱 Состояние инстанса:', stateResponse.data);
    
    // Проверяем информацию об аккаунте
    const accountResponse = await axios.get(`${BASE_URL}/getWaSettings/${API_TOKEN}`);
    console.log('👤 Настройки WhatsApp:', accountResponse.data);
    
    res.json({
      success: true,
      settings: settingsResponse.data,
      state: stateResponse.data,
      account: accountResponse.data,
      baseUrl: BASE_URL
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки API:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      baseUrl: BASE_URL
    });
  }
});

// Endpoint для отправки тестового сообщения
app.post('/test-message', async (req, res) => {
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Требуются параметры chatId и message'
      });
    }
    
    console.log(`📤 Отправляем тестовое сообщение в ${chatId}: ${message}`);
    
    const result = await sendMessage(chatId, message);
    
    res.json({
      success: true,
      result: result,
      message: 'Тестовое сообщение отправлено'
    });
    
  } catch (error) {
    console.error('❌ Ошибка отправки тестового сообщения:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/webhook', async (req, res) => {
  console.log('🔔 Получен POST запрос на /webhook');
  console.log('Полное тело запроса:', JSON.stringify(req.body, null, 2));
  
  try {
    const body = req.body;
    
    // Проверяем, что это входящее сообщение, а не исходящее
    const isIncomingMessage = body?.typeWebhook === 'incomingMessageReceived';
    const isOutgoingMessage = body?.typeWebhook === 'outgoingMessageReceived';
    
    console.log('🔍 Анализ webhook:');
    console.log('- Тип webhook:', body?.typeWebhook);
    console.log('- Входящее сообщение:', isIncomingMessage);
    console.log('- Исходящее сообщение:', isOutgoingMessage);
    
    // Обрабатываем только входящие сообщения
    if (!isIncomingMessage) {
      console.log('⏭️ Пропускаем - не входящее сообщение');
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook получен, но не обработан (не входящее сообщение)' 
      });
    }
    
    // Более детальная проверка структуры webhook
    let chatId = null;
    let messageText = null;
    let webhookType = null;
    let senderId = null;
    
    // Проверяем разные типы webhook от Green API
    if (body?.body?.senderData?.chatId) {
      chatId = body.body.senderData.chatId;
      senderId = body.body.senderData.sender;
      webhookType = 'senderData';
    } else if (body?.senderData?.chatId) {
      chatId = body.senderData.chatId;
      senderId = body.senderData.sender;
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
    
    console.log('📋 Извлеченные данные:');
    console.log('- Chat ID:', chatId);
    console.log('- Sender ID:', senderId);
    console.log('- Message Text:', messageText);
    console.log('- Webhook Type:', webhookType);
    
    // Проверяем, что сообщение не от самого бота
    const instanceId = process.env.ID_INSTANCE;
    const isFromBot = senderId && senderId.includes(instanceId);
    
    if (isFromBot) {
      console.log('🤖 Пропускаем - сообщение от самого бота');
      return res.status(200).json({ 
        success: true, 
        message: 'Сообщение от бота - пропущено' 
      });
    }
    
    if (chatId && messageText) {
      console.log('✅ Найден Chat ID и текст сообщения, отправляем ответ...');
      
      // Добавляем небольшую задержку
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('📤 Отправляем приветственное сообщение...');
      await sendMessage(chatId, 'ЗДЕСЬ БУДЕТ ПРИВЕТСТВЕННЫЙ ТЕКСТ');
      
      console.log('📤 Отправляем первую группу кнопок...');
      await sendButtons(chatId, 'Выберите вариант 1:', ['Кнопка 1', 'Кнопка 2', 'Кнопка 3']);
      
      console.log('📤 Отправляем вторую группу кнопок...');
      await sendButtons(chatId, 'Выберите вариант 2:', ['Кнопка 4', 'Кнопка 5', 'Кнопка 6']);
      
      console.log('📤 Отправляем последнее сообщение...');
      await sendMessage(chatId, 'Кнопка 7');
      
      console.log('✅ Все сообщения отправлены успешно');
    } else {
      console.log('❌ Недостаточно данных для ответа:');
      console.log('- Chat ID найден:', !!chatId);
      console.log('- Текст сообщения найден:', !!messageText);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Webhook обработан',
      chatId: chatId,
      webhookType: webhookType,
      processed: !!(chatId && messageText)
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