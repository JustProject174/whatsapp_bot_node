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
    console.log('🔍 Проверяем данные для отправки сообщения:');
    console.log('- Chat ID:', chatId);
    console.log('- Text:', text);
    console.log('- URL:', `${BASE_URL}/sendMessage/${API_TOKEN}`);
    
    const payload = {
      chatId,
      message: text,
    };
    
    console.log('📤 Payload для сообщения:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/sendMessage/${API_TOKEN}`, payload);
    console.log('✅ Сообщение отправлено:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:');
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);
    console.error('- Data:', error.response?.data);
    console.error('- Headers:', error.response?.headers);
    console.error('- Config URL:', error.config?.url);
    console.error('- Base URL:', BASE_URL);
    console.error('- API Token length:', API_TOKEN ? API_TOKEN.length : 'undefined');
    console.error('- ID Instance:', ID_INSTANCE);
    throw error;
  }
};

const sendButtons = async (chatId, message, buttons) => {
  try {
    console.log('🔍 Проверяем данные для отправки кнопок:');
    console.log('- Chat ID:', chatId);
    console.log('- Message:', message);
    console.log('- Buttons:', buttons);
    console.log('- URL:', `${BASE_URL}/sendButtons/${API_TOKEN}`);
    
    const formattedButtons = buttons.map((text, index) => ({
      buttonId: `btn_${index + 1}`,
      buttonText: { displayText: text },
      type: 1,
    }));

    const payload = {
      chatId,
      message,
      footer: "", // Добавляем пустой footer
      buttons: formattedButtons,
    };
    
    console.log('📤 Payload для кнопок:', JSON.stringify(payload, null, 2));

    const response = await axios.post(`${BASE_URL}/sendButtons/${API_TOKEN}`, payload);
    console.log('✅ Кнопки отправлены:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отправки кнопок:');
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);
    console.error('- Data:', error.response?.data);
    console.error('- Headers:', error.response?.headers);
    console.error('- Config URL:', error.config?.url);
    
    // Если кнопки не работают, отправляем обычное сообщение
    console.log('🔄 Отправляем обычное сообщение вместо кнопок...');
    const buttonsList = buttons.map((btn, index) => `${index + 1}. ${btn}`).join('\n');
    await sendMessage(chatId, `${message}\n\n${buttonsList}`);
    
    return { fallback: true, message: 'Кнопки заменены на текст' };
  }
};

// Добавляем функцию для отправки списка (альтернатива кнопкам)
const sendList = async (chatId, title, description, sections) => {
  try {
    console.log('🔍 Отправляем список:');
    console.log('- Chat ID:', chatId);
    console.log('- Title:', title);
    console.log('- Sections:', sections);
    
    const payload = {
      chatId,
      message: {
        text: title,
        title: title,
        description: description,
        buttonText: "Выбрать",
        sections: sections.map((section, sectionIndex) => ({
          title: section.title || `Раздел ${sectionIndex + 1}`,
          rows: section.items.map((item, itemIndex) => ({
            title: item,
            description: "",
            rowId: `option_${sectionIndex}_${itemIndex}`
          }))
        }))
      }
    };
    
    console.log('📤 Payload для списка:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/sendListMessage/${API_TOKEN}`, payload);
    console.log('✅ Список отправлен:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отправки списка:', error.response?.data || error.message);
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
    console.log('🔧 Конфигурация:');
    console.log('- ID_INSTANCE:', ID_INSTANCE);
    console.log('- API_TOKEN:', API_TOKEN ? `${API_TOKEN.substring(0, 10)}...` : 'НЕ УСТАНОВЛЕН');
    console.log('- BASE_URL:', BASE_URL);
    
    // Проверяем состояние инстанса
    console.log('📡 Проверяем состояние инстанса...');
    const stateResponse = await axios.get(`${BASE_URL}/getStateInstance/${API_TOKEN}`);
    console.log('📱 Состояние инстанса:', stateResponse.data);
    
    // Проверяем настройки инстанса
    console.log('📡 Проверяем настройки инстанса...');
    const settingsResponse = await axios.get(`${BASE_URL}/getSettings/${API_TOKEN}`);
    console.log('⚙️ Настройки инстанса:', settingsResponse.data);
    
    // Проверяем информацию об аккаунте
    console.log('📡 Проверяем настройки WhatsApp...');
    const accountResponse = await axios.get(`${BASE_URL}/getWaSettings/${API_TOKEN}`);
    console.log('👤 Настройки WhatsApp:', accountResponse.data);
    
    res.json({
      success: true,
      config: {
        idInstance: ID_INSTANCE,
        apiTokenLength: API_TOKEN ? API_TOKEN.length : 0,
        baseUrl: BASE_URL
      },
      state: stateResponse.data,
      settings: settingsResponse.data,
      account: accountResponse.data
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки API:');
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);
    console.error('- Data:', error.response?.data);
    console.error('- URL:', error.config?.url);
    
    res.status(500).json({
      success: false,
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      },
      config: {
        idInstance: ID_INSTANCE,
        apiTokenLength: API_TOKEN ? API_TOKEN.length : 0,
        baseUrl: BASE_URL
      }
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

// Endpoint для настройки webhook через API
app.post('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `https://${req.get('host')}/webhook`;
    
    console.log('🔧 Настраиваем webhook:', webhookUrl);
    
    // Настраиваем webhook URL
    const webhookResponse = await axios.post(`${BASE_URL}/setWebhook/${API_TOKEN}`, {
      webhookUrl: webhookUrl,
      set: true
    });
    
    console.log('📡 Webhook URL установлен:', webhookResponse.data);
    
    // Настраиваем типы уведомлений
    const settingsResponse = await axios.post(`${BASE_URL}/setSettings/${API_TOKEN}`, {
      webhookUrl: webhookUrl,
      webhookUrlToken: "",
      delaySendMessagesMilliseconds: 1000,
      markIncomingMessagesReaded: "no",
      proxyInstance: "",
      outgoingWebhook: "no",          // Отключаем исходящие
      incomingWebhook: "yes",         // Включаем входящие
      deviceWebhook: "no",
      statusInstanceWebhook: "no",
      sendFromUTC: "no"
    });
    
    console.log('⚙️ Настройки webhook обновлены:', settingsResponse.data);
    
    res.json({
      success: true,
      webhookUrl: webhookUrl,
      webhookResponse: webhookResponse.data,
      settingsResponse: settingsResponse.data,
      message: 'Webhook настроен успешно'
    });
    
  } catch (error) {
    console.error('❌ Ошибка настройки webhook:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
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
      
      try {
        console.log('📤 Отправляем приветственное сообщение с кнопками...');
        
        // Вариант 1: Попробуем отправить кнопки
        try {
          await sendButtons(chatId, 
            "Добро пожаловать! Выберите один из вариантов:", 
            ["Кнопка 1", "Кнопка 2", "Кнопка 3"]
          );
          console.log('✅ Кнопки отправлены успешно!');
        } catch (buttonError) {
          console.log('⚠️ Кнопки не поддерживаются, пробуем список...');
          
          // Вариант 2: Попробуем отправить список
          try {
            await sendList(chatId, 
              "Добро пожаловать!", 
              "Выберите один из вариантов:",
              [
                {
                  title: "Основные опции",
                  items: ["Кнопка 1", "Кнопка 2", "Кнопка 3"]
                },
                {
                  title: "Дополнительные опции", 
                  items: ["Кнопка 4", "Кнопка 5", "Кнопка 6"]
                }
              ]
            );
            console.log('✅ Список отправлен успешно!');
          } catch (listError) {
            console.log('⚠️ Список тоже не поддерживается, отправляем обычное сообщение...');
            
            // Вариант 3: Отправляем обычное сообщение с пронумерованными пунктами
            await sendMessage(chatId, `Добро пожаловать! 

Выберите один из вариантов:

1️⃣ Кнопка 1
2️⃣ Кнопка 2  
3️⃣ Кнопка 3

4️⃣ Кнопка 4
5️⃣ Кнопка 5
6️⃣ Кнопка 6

7️⃣ Кнопка 7

Просто отправьте номер нужного варианта!`);
            console.log('✅ Обычное сообщение отправлено!');
          }
        }
        
      } catch (error) {
        console.error('❌ Ошибка при отправке сообщения:', error.message);
      }
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