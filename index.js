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

// Endpoint для просмотра активных пользователей
app.get('/users', (req, res) => {
  const users = Array.from(userSessions.entries()).map(([chatId, session]) => ({
    chatId,
    firstContact: session.firstContact,
    lastActivity: session.lastActivity,
    messageCount: session.messageCount
  }));
  
  res.json({
    success: true,
    totalUsers: users.length,
    users: users
  });
});

// Endpoint для сброса пользовательских сессий (для тестирования)
app.post('/reset-users', (req, res) => {
  const { chatId } = req.body;
  
  if (chatId) {
    // Сбрасываем конкретного пользователя
    if (userSessions.has(chatId)) {
      userSessions.delete(chatId);
      res.json({
        success: true,
        message: `Пользователь ${chatId} сброшен`
      });
    } else {
      res.json({
        success: false,
        message: `Пользователь ${chatId} не найден`
      });
    }
  } else {
    // Сбрасываем всех пользователей
    userSessions.clear();
    res.json({
      success: true,
      message: 'Все пользователи сброшены'
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

// Храним информацию о пользователях в памяти (в продакшене используйте базу данных)
const userSessions = new Map();

// Функция для проверки, новый ли это пользователь
const isNewUser = (chatId) => {
  return !userSessions.has(chatId);
};

// Функция для отметки пользователя как известного
const markUserAsKnown = (chatId) => {
  userSessions.set(chatId, {
    firstContact: new Date(),
    lastActivity: new Date(),
    messageCount: 0
  });
};

// Функция для обновления активности пользователя
const updateUserActivity = (chatId) => {
  if (userSessions.has(chatId)) {
    const session = userSessions.get(chatId);
    session.lastActivity = new Date();
    session.messageCount++;
    userSessions.set(chatId, session);
  }
};

// Функция для отправки приветственного сообщения
const sendWelcomeMessage = async (chatId) => {
  console.log('📤 Отправляем приветственное сообщение новому пользователю...');
  
  try {
    // Вариант 1: Попробуем отправить кнопки
    await sendButtons(chatId, 
      "👋 Добро пожаловать!\n\nЯ ваш WhatsApp помощник. Выберите один из вариантов:", 
      ["🏠 Главная", "ℹ️ Информация", "📞 Контакты"]
    );
    console.log('✅ Приветственные кнопки отправлены успешно!');
  } catch (buttonError) {
    console.log('⚠️ Кнопки не поддерживаются, пробуем список...');
    
    try {
      // Вариант 2: Попробуем отправить список
      await sendList(chatId, 
        "👋 Добро пожаловать!", 
        "Я ваш WhatsApp помощник. Выберите один из вариантов:",
        [
          {
            title: "Основные функции",
            items: ["🏠 Главная", "ℹ️ Информация", "📞 Контакты"]
          },
          {
            title: "Дополнительно", 
            items: ["⚙️ Настройки", "📋 Помощь", "💬 Чат с оператором"]
          }
        ]
      );
      console.log('✅ Приветственный список отправлен успешно!');
    } catch (listError) {
      console.log('⚠️ Список тоже не поддерживается, отправляем обычное сообщение...');
      
      // Вариант 3: Отправляем обычное сообщение с пронумерованными пунктами
      await sendMessage(chatId, `👋 *Добро пожаловать!*

Я ваш WhatsApp помощник. Выберите один из вариантов:

🏠 *1* - Главная
ℹ️ *2* - Информация  
📞 *3* - Контакты
⚙️ *4* - Настройки
📋 *5* - Помощь
💬 *6* - Чат с оператором

Просто отправьте номер нужного варианта!`);
      console.log('✅ Приветственное сообщение отправлено!');
    }
  }
};

// Функция для обработки команд пользователя
const handleUserMessage = async (chatId, messageText) => {
  const lowerMessage = messageText.toLowerCase().trim();
  
  console.log(`📨 Обрабатываем сообщение от ${chatId}: "${messageText}"`);
  
  // Обработка команд
  switch (lowerMessage) {
    case '1':
    case 'главная':
    case 'home':
      await sendMessage(chatId, "🏠 *Главная страница*\n\nВы находитесь в главном меню. Здесь вы можете выбрать нужную функцию.");
      break;
      
    case '2':
    case 'информация':
    case 'info':
      await sendMessage(chatId, "ℹ️ *Информация*\n\nЭто WhatsApp бот-помощник. Я могу помочь вам с различными вопросами и задачами.");
      break;
      
    case '3':
    case 'контакты':
    case 'contacts':
      await sendMessage(chatId, "📞 *Контакты*\n\n• Телефон: +7 (XXX) XXX-XX-XX\n• Email: info@example.com\n• Сайт: www.example.com");
      break;
      
    case '4':
    case 'настройки':
    case 'settings':
      await sendMessage(chatId, "⚙️ *Настройки*\n\nЗдесь вы можете настроить параметры работы бота.");
      break;
      
    case '5':
    case 'помощь':
    case 'help':
      await sendMessage(chatId, "📋 *Помощь*\n\nДоступные команды:\n• 1 - Главная\n• 2 - Информация\n• 3 - Контакты\n• 4 - Настройки\n• 5 - Помощь\n• 6 - Чат с оператором");
      break;
      
    case '6':
    case 'оператор':
    case 'operator':
      await sendMessage(chatId, "💬 *Подключение к оператору*\n\nВаш запрос передан оператору. Ожидайте ответа в течение 5-10 минут.");
      break;
      
    case 'старт':
    case 'start':
    case '/start':
      // Если пользователь написал "старт", показываем меню заново
      await sendWelcomeMessage(chatId);
      break;
      
    default:
      // Для неизвестных команд предлагаем помощь
      await sendMessage(chatId, `❓ Не понимаю команду "${messageText}".\n\nНапишите *"помощь"* или *"5"* для просмотра доступных команд.\nДля возврата в главное меню напишите *"старт"*.`);
      break;
  }
};

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
      console.log('✅ Найден Chat ID и текст сообщения');
      
      try {
        // Проверяем, новый ли это пользователь
        if (isNewUser(chatId)) {
          console.log('🆕 Новый пользователь! Отправляем приветственное сообщение...');
          
          // Отмечаем пользователя как известного
          markUserAsKnown(chatId);
          
          // Отправляем приветственное сообщение
          await sendWelcomeMessage(chatId);
          
        } else {
          console.log('👤 Существующий пользователь, обрабатываем сообщение...');
          
          // Обновляем активность существующего пользователя
          updateUserActivity(chatId);
          
          // Обрабатываем команду пользователя
          await handleUserMessage(chatId, messageText);
        }
        
      } catch (error) {
        console.error('❌ Ошибка при обработке сообщения:', error.message);
        
        // Отправляем сообщение об ошибке пользователю
        try {
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз или напишите 'помощь'.");
        } catch (sendError) {
          console.error('❌ Не удалось отправить сообщение об ошибке:', sendError.message);
        }
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
      processed: !!(chatId && messageText),
      newUser: chatId ? isNewUser(chatId) : false
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