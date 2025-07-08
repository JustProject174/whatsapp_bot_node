require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);

  if (req.path !== "/webhook" || process.env.DEBUG_WEBHOOKS === "true") {
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Configuration
const config = {
  idInstance: process.env.ID_INSTANCE,
  apiToken: process.env.API_TOKEN_INSTANCE,
  baseUrl: `https://1103.api.green-api.com/waInstance${process.env.ID_INSTANCE}`,
  port: process.env.PORT || 3000,
  debug: process.env.DEBUG === "true",
};

// Validate configuration
if (!config.idInstance || !config.apiToken) {
  console.error(
    "❌ Ошибка: ID_INSTANCE и API_TOKEN_INSTANCE должны быть установлены в .env файле",
  );
  process.exit(1);
}

// User sessions storage (в продакшене используйте Redis или базу данных)
class UserSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  isNewUser(chatId) {
    return !this.sessions.has(chatId);
  }

  createUser(chatId) {
    this.sessions.set(chatId, {
      firstContact: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      state: "welcome",
    });
  }

  updateActivity(chatId) {
    if (this.sessions.has(chatId)) {
      const session = this.sessions.get(chatId);
      session.lastActivity = new Date();
      session.messageCount++;
      this.sessions.set(chatId, session);
    }
  }

  getUserState(chatId) {
    return this.sessions.get(chatId)?.state || "welcome";
  }

  setUserState(chatId, state) {
    if (this.sessions.has(chatId)) {
      const session = this.sessions.get(chatId);
      session.state = state;
      this.sessions.set(chatId, session);
    }
  }

  getAllUsers() {
    return Array.from(this.sessions.entries()).map(([chatId, session]) => ({
      chatId,
      ...session,
    }));
  }

  deleteUser(chatId) {
    return this.sessions.delete(chatId);
  }

  clear() {
    this.sessions.clear();
  }
}

const userManager = new UserSessionManager();

// Green API Service
class GreenAPIService {
  constructor(baseUrl, apiToken) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.axios = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async makeRequest(endpoint, data = null, method = "GET") {
    const url = `${this.baseUrl}/${endpoint}/${this.apiToken}`;

    try {
      const response =
        method === "GET"
          ? await this.axios.get(url)
          : await this.axios.post(url, data);

      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Ошибка API ${endpoint}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url,
      });

      return {
        success: false,
        error: error.response?.data || { message: error.message },
      };
    }
  }

  async sendMessage(chatId, text) {
    console.log(
      `📤 Отправка сообщения в ${chatId}:`,
      text.substring(0, 100) + "...",
    );

    const result = await this.makeRequest(
      "sendMessage",
      {
        chatId,
        message: text,
      },
      "POST",
    );

    if (result.success) {
      console.log("✅ Сообщение отправлено");
    } else {
      console.error("❌ Ошибка отправки сообщения:", result.error);
    }

    return result;
  }

  async sendButtons(chatId, message, buttons) {
    console.log(`📤 Отправка кнопок в ${chatId}`);

    const formattedButtons = buttons.map((text, index) => ({
      buttonId: `btn_${index + 1}`,
      buttonText: { displayText: text },
      type: 1,
    }));

    const result = await this.makeRequest(
      "sendButtons",
      {
        chatId,
        message,
        footer: "",
        buttons: formattedButtons,
      },
      "POST",
    );

    if (!result.success) {
      // Fallback: отправляем обычное сообщение с пронумерованным списком
      const buttonsList = buttons
        .map((btn, index) => `${index + 1}. ${btn}`)
        .join("\n");
      const fallbackMessage = `${message}\n\n${buttonsList}`;
      return await this.sendMessage(chatId, fallbackMessage);
    }

    return result;
  }

  async sendList(chatId, title, description, sections) {
    console.log(`📤 Отправка списка в ${chatId}`);

    const formattedSections = sections.map((section, sectionIndex) => ({
      title: section.title || `Раздел ${sectionIndex + 1}`,
      rows: section.items.map((item, itemIndex) => ({
        title: item,
        description: "",
        rowId: `option_${sectionIndex}_${itemIndex}`,
      })),
    }));

    return await this.makeRequest(
      "sendListMessage",
      {
        chatId,
        message: {
          text: title,
          title: title,
          description: description,
          buttonText: "Выбрать",
          sections: formattedSections,
        },
      },
      "POST",
    );
  }

  async getInstanceState() {
    return await this.makeRequest("getStateInstance");
  }

  async getSettings() {
    return await this.makeRequest("getSettings");
  }

  async getWaSettings() {
    return await this.makeRequest("getWaSettings");
  }

  async setWebhook(webhookUrl) {
    return await this.makeRequest(
      "setWebhook",
      {
        webhookUrl: webhookUrl,
        set: true,
      },
      "POST",
    );
  }

  async updateSettings(settings) {
    return await this.makeRequest("setSettings", settings, "POST");
  }
}

const greenAPI = new GreenAPIService(config.baseUrl, config.apiToken);

// Message Templates
const messages = {
  welcome: `👋 *Здравствуйте! Добро пожаловать на базу отдыха у озера* 🌲🏡

Меня зовут Юлия, я с радостью помогу вам с подбором размещения.

📍 *Перед тем, как мы продолжим, обратите внимание на важную информацию:*

Выберите один из вариантов:`,

  importantInfo: `🔔 *Важная информация*

📌 Наша база расположена *на берегу озера* в *заповедной зоне*. 

💧 *В целях сохранения экологии:*
• *Центральная канализация и водопровод отсутствуют*
• *Душа нет*, но есть прекрасные *русские бани на дровах* (как для помывки, так и для отдыха)
• *Удобства на улице* 

🧻 Большой дачный туалет на территории
👶 Дети до 5 лет — бесплатно (если без отдельного спального места)

Если такие условия вас устраивают, давайте расскажу подробнее 😊

Для возврата в меню напишите *"меню"*`,

  rooms: `🛏️ *Номерной фонд*

🏠 *КОМФОРТ*
• Включено: постельное белье, посуда, кухня, мангал
• Без душа и туалета в домах (есть бани и удобства на улице)
• Примеры:
  - Дом №8 (4 чел.) — от *9999₽*
  - Дом №9/10 (6 чел.) — от *10999₽*
  - Дом №14 (до 10+ чел.) — от *21999₽*

🛏️ *ЭКОНОМ*
• 4 или 5 односпальных кроватей
• Без постельного белья и посуды (можно взять с собой или арендовать: *200₽/комплект*)
• Холодильник — уточняйте по каждой комнате
• Общая кухня на территории
• Примеры:
  - Комната в даче 1,2,4,11,13 (4 чел.) — от *4999₽*
  - Комната в даче 6 (5 чел.) — от *5499₽*

Для того, чтобы начать бронирование напишите *"бронирование"*
Для возврата в меню напишите *"меню"*`,

  entertainment: `🚣 *Развлечения*

🏖 *На территории:*
• Купание в озере
• Русская баня с парением и нырянием ❄️
• Прокат:
  - Сапборд — *1200₽/час*
  - Байдарка
  - Лодка

🍢 Большие мангальные зоны с лавками и столами включены в стоимость!

Для возврата в меню напишите *"меню"*`,

  territory: `📍 *На территории*

🍽️ *Удобства:*
• Общая кухня с газовыми плитами
• Парковка:
  - Легковой авто — *500₽/сутки*
  - Газель — *1000₽/сутки*
• Чистейшая родниковая вода из озера
• Запас питьевой воды, решётки и угли — берите с собой

Для возврата в меню напишите *"меню"*`,

  contacts: `📞 *Контакты*

В случае если у вас остались вопросы можно писать в телеграм :
📱 https://t.me/Zolotye_peski174_bot

🌐 Подробности на сайте: https://bazaturgoyak.ru/

⏰ *Время работы:*
• Ежедневно: 9:00 - 21:00
• Экстренная связь: круглосуточно

Для возврата в меню напишите *"меню"*`,

  directions: `🚗 *Как добраться*

📍 Координаты: 55.1881079369311, 60.05969764417703.
https://yandex.ru/maps/?ll=60.061851%2C55.187183&mode=routes&rtext=~55.187969%2C60.059069&rtt=auto&ruri=~ymapsbm1%3A%2F%2Forg%3Foid%3D109014041624&source=serp_navig&z=15.3



🚙 Возможен заезд на автомобиле, парковка платная.'


  help: `📋 *Помощь*

*Доступные команды:*
• *меню* - главное меню
• *информация* - важная информация  
• *номера* - номерной фонд
• *развлечения* - что можно делать
• *территория* - что есть на базе
• *контакты* - как связаться
• *добраться* - как доехать
• *бронирование* - забронировать номер
• *помощь* - эта справка

Для связи с оператором напишите *"оператор"*`,

  operator: `👩‍💼 *Подключение к оператору*

Ваш запрос передан оператору. 
Ожидайте ответа в течение 5-10 минут.

В рабочее время (9:00-21:00) ответим быстрее!

Для возврата в меню напишите *"меню"*`,

  booking: `📋 *Бронирование номера*

Для бронирования:
1. Перейдите в наш Телеграм-бот - https://t.me/Zolotye_peski174_bot
2. Воспользуйтесь нашим сайтом - https://bazaturgoyak.ru/



Для возврата в меню напишите *"меню"*`,

  unknown: `❓ Не понимаю эту команду.

Напишите *"помощь"* для просмотра доступных команд.
Или напишите *"меню"* для возврата в главное меню.
Для связи с оператором напишите *"оператор"*.`,
};

// Message Handler
class MessageHandler {
  constructor(greenAPI, userManager) {
    this.greenAPI = greenAPI;
    this.userManager = userManager;

    this.menuButtons = [
      "🔔 Важная информация",
      "🛏️ Номерной фонд",
      "🚣 Развлечения",
      "📍 На территории",
      "📞 Контакты",
      "🚗 Как добраться",
    ];
  }

  async handleNewUser(chatId) {
    console.log("🆕 Обработка нового пользователя:", chatId);

    this.userManager.createUser(chatId);
    await this.sendWelcomeMessage(chatId);
  }

  async handleExistingUser(chatId, messageText) {
    console.log("👤 Обработка существующего пользователя:", chatId);

    this.userManager.updateActivity(chatId);
    await this.processCommand(chatId, messageText);
  }

  async sendWelcomeMessage(chatId) {
    try {
      const result = await this.greenAPI.sendButtons(
        chatId,
        messages.welcome,
        this.menuButtons,
      );

      if (!result.success) {
        // Fallback: обычное сообщение с меню
        const menuText = `${messages.welcome}\n\n${this.menuButtons.map((btn, i) => `${i + 1}. ${btn}`).join("\n")}\n\nПросто отправьте номер нужного варианта!`;
        await this.greenAPI.sendMessage(chatId, menuText);
      }
    } catch (error) {
      console.error("❌ Ошибка отправки приветствия:", error);
      await this.greenAPI.sendMessage(chatId, messages.help);
    }
  }

  async processCommand(chatId, messageText) {
    const command = messageText.toLowerCase().trim();

    // Маппинг команд
    const commandMap = {
      // Цифровые команды для кнопок
      1: () => this.greenAPI.sendMessage(chatId, messages.importantInfo),
      2: () => this.greenAPI.sendMessage(chatId, messages.rooms),
      3: () => this.greenAPI.sendMessage(chatId, messages.entertainment),
      4: () => this.greenAPI.sendMessage(chatId, messages.territory),
      5: () => this.greenAPI.sendMessage(chatId, messages.contacts),
      6: () => this.greenAPI.sendMessage(chatId, messages.directions),

      // Текстовые команды
      меню: () => this.sendWelcomeMessage(chatId),
      старт: () => this.sendWelcomeMessage(chatId),
      start: () => this.sendWelcomeMessage(chatId),
      "/start": () => this.sendWelcomeMessage(chatId),

      информация: () =>
        this.greenAPI.sendMessage(chatId, messages.importantInfo),
      "важная информация": () =>
        this.greenAPI.sendMessage(chatId, messages.importantInfo),

      номера: () => this.greenAPI.sendMessage(chatId, messages.rooms),
      "номерной фонд": () => this.greenAPI.sendMessage(chatId, messages.rooms),
      комнаты: () => this.greenAPI.sendMessage(chatId, messages.rooms),

      развлечения: () =>
        this.greenAPI.sendMessage(chatId, messages.entertainment),
      "что делать": () =>
        this.greenAPI.sendMessage(chatId, messages.entertainment),

      территория: () => this.greenAPI.sendMessage(chatId, messages.territory),
      "на территории": () =>
        this.greenAPI.sendMessage(chatId, messages.territory),
      услуги: () => this.greenAPI.sendMessage(chatId, messages.territory),

      контакты: () => this.greenAPI.sendMessage(chatId, messages.contacts),
      телефон: () => this.greenAPI.sendMessage(chatId, messages.contacts),

      добраться: () => this.greenAPI.sendMessage(chatId, messages.directions),
      "как добраться": () =>
        this.greenAPI.sendMessage(chatId, messages.directions),
      дорога: () => this.greenAPI.sendMessage(chatId, messages.directions),

      помощь: () => this.greenAPI.sendMessage(chatId, messages.help),
      help: () => this.greenAPI.sendMessage(chatId, messages.help),
      команды: () => this.greenAPI.sendMessage(chatId, messages.help),

      оператор: () => this.greenAPI.sendMessage(chatId, messages.operator),
      человек: () => this.greenAPI.sendMessage(chatId, messages.operator),
      поддержка: () => this.greenAPI.sendMessage(chatId, messages.operator),

      бронирование: () => this.greenAPI.sendMessage(chatId, messages.booking),
      забронировать: () => this.greenAPI.sendMessage(chatId, messages.booking),
      заказать: () => this.greenAPI.sendMessage(chatId, messages.booking),

      трансфер: () =>
        this.greenAPI.sendMessage(
          chatId,
          `🚖 *Трансфера у нас нет, просим добираться самостоятельно*`,
        ),
    };

    // Выполняем команду
    const handler = commandMap[command];
    if (handler) {
      await handler();
    } else {
      await this.greenAPI.sendMessage(chatId, messages.unknown);
    }
  }
}

const messageHandler = new MessageHandler(greenAPI, userManager);

// Webhook Processor
class WebhookProcessor {
  constructor(messageHandler, userManager) {
    this.messageHandler = messageHandler;
    this.userManager = userManager;
  }

  extractWebhookData(body) {
    const data = {
      chatId: null,
      messageText: null,
      senderId: null,
      isIncoming: false,
    };

    // Проверяем тип webhook
    data.isIncoming = body?.typeWebhook === "incomingMessageReceived";

    if (!data.isIncoming) {
      return data;
    }

    // Извлекаем chatId
    data.chatId =
      body?.body?.senderData?.chatId ||
      body?.senderData?.chatId ||
      body?.body?.chatId ||
      body?.chatId;

    // Извлекаем senderId
    data.senderId = body?.body?.senderData?.sender || body?.senderData?.sender;

    // Извлекаем текст сообщения
    data.messageText =
      body?.body?.messageData?.textMessageData?.textMessage ||
      body?.messageData?.textMessageData?.textMessage;

    return data;
  }

  isMessageFromBot(senderId) {
    return senderId && senderId.includes(config.idInstance);
  }

  async processWebhook(body) {
    const data = this.extractWebhookData(body);

    console.log("📋 Данные webhook:", {
      chatId: data.chatId,
      messageText: data.messageText?.substring(0, 50) + "...",
      senderId: data.senderId,
      isIncoming: data.isIncoming,
    });

    // Проверки
    if (!data.isIncoming) {
      return { processed: false, reason: "Не входящее сообщение" };
    }

    if (!data.chatId || !data.messageText) {
      return { processed: false, reason: "Недостаточно данных" };
    }

    if (this.isMessageFromBot(data.senderId)) {
      return { processed: false, reason: "Сообщение от бота" };
    }

    // Обработка сообщения
    try {
      if (this.userManager.isNewUser(data.chatId)) {
        await this.messageHandler.handleNewUser(data.chatId);
      } else {
        await this.messageHandler.handleExistingUser(
          data.chatId,
          data.messageText,
        );
      }

      return {
        processed: true,
        chatId: data.chatId,
        newUser: this.userManager.isNewUser(data.chatId),
      };
    } catch (error) {
      console.error("❌ Ошибка обработки сообщения:", error);

      // Отправляем сообщение об ошибке
      try {
        await greenAPI.sendMessage(
          data.chatId,
          "❌ Произошла техническая ошибка. Попробуйте позже или напишите 'оператор'.",
        );
      } catch (sendError) {
        console.error(
          "❌ Не удалось отправить сообщение об ошибке:",
          sendError,
        );
      }

      return { processed: false, reason: error.message };
    }
  }
}

const webhookProcessor = new WebhookProcessor(messageHandler, userManager);

// Routes
// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "WhatsApp Bot для базы отдыха",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API status check
app.get("/api/status", async (req, res) => {
  try {
    const [stateResult, settingsResult] = await Promise.all([
      greenAPI.getInstanceState(),
      greenAPI.getSettings(),
    ]);

    res.json({
      success: true,
      config: {
        idInstance: config.idInstance,
        apiTokenLength: config.apiToken ? config.apiToken.length : 0,
        baseUrl: config.baseUrl,
      },
      state: stateResult.success ? stateResult.data : stateResult.error,
      settings: settingsResult.success
        ? settingsResult.data
        : settingsResult.error,
      users: {
        total: userManager.getAllUsers().length,
        active: userManager
          .getAllUsers()
          .filter(
            (u) =>
              Date.now() - new Date(u.lastActivity).getTime() <
              24 * 60 * 60 * 1000,
          ).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Users management
app.get("/api/users", (req, res) => {
  const users = userManager.getAllUsers();
  res.json({
    success: true,
    total: users.length,
    users: users,
  });
});

app.post("/api/users/reset", (req, res) => {
  const { chatId } = req.body;

  if (chatId) {
    const deleted = userManager.deleteUser(chatId);
    res.json({
      success: deleted,
      message: deleted
        ? `Пользователь ${chatId} удален`
        : `Пользователь ${chatId} не найден`,
    });
  } else {
    userManager.clear();
    res.json({
      success: true,
      message: "Все пользователи удалены",
    });
  }
});

// Test message
app.post("/api/test-message", async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: "Требуются параметры chatId и message",
      });
    }

    const result = await greenAPI.sendMessage(chatId, message);

    res.json({
      success: result.success,
      result: result.data || result.error,
      message: result.success ? "Сообщение отправлено" : "Ошибка отправки",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Webhook setup
app.post("/api/setup-webhook", async (req, res) => {
  try {
    const webhookUrl = `https://${req.get("host")}/webhook`;

    console.log("🔧 Настройка webhook:", webhookUrl);

    const [webhookResult, settingsResult] = await Promise.all([
      greenAPI.setWebhook(webhookUrl),
      greenAPI.updateSettings({
        webhookUrl: webhookUrl,
        webhookUrlToken: "",
        delaySendMessagesMilliseconds: 1000,
        markIncomingMessagesReaded: "no",
        proxyInstance: "",
        outgoingWebhook: "no",
        incomingWebhook: "yes",
        deviceWebhook: "no",
        statusInstanceWebhook: "no",
        sendFromUTC: "no",
      }),
    ]);

    res.json({
      success: webhookResult.success && settingsResult.success,
      webhookUrl: webhookUrl,
      webhook: webhookResult,
      settings: settingsResult,
      message:
        webhookResult.success && settingsResult.success
          ? "Webhook настроен успешно"
          : "Ошибка настройки webhook",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main webhook endpoint
app.post("/webhook", async (req, res) => {
  console.log("🔔 Webhook получен");

  try {
    const result = await webhookProcessor.processWebhook(req.body);

    res.status(200).json({
      success: true,
      processed: result.processed,
      reason: result.reason,
      chatId: result.chatId,
      newUser: result.newUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Критическая ошибка webhook:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Webhook verification (GET)
app.get("/webhook", (req, res) => {
  res.json({
    status: "Webhook endpoint активен",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Необработанная ошибка:", error);
  res.status(500).json({
    success: false,
    error: "Внутренняя ошибка сервера",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint не найден",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Получен SIGTERM, корректное завершение...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Получен SIGINT, корректное завершение...");
  process.exit(0);
});

// Start server
app.listen(config.port, () => {
  console.log(`⚡ Сервер запущен на порту ${config.port}`);
  console.log(`🌐 URL: http://localhost:${config.port}`);
  console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
  console.log("📋 Конфигурация:");
  console.log(
    "- ID_INSTANCE:",
    config.idInstance ? "✅ Установлен" : "❌ Не установлен",
  );
  console.log(
    "- API_TOKEN:",
    config.apiToken ? "✅ Установлен" : "❌ Не установлен",
  );
  console.log("- DEBUG режим:", config.debug ? "✅ Включен" : "❌ Выключен");
  console.log("\n🚀 WhatsApp бот готов к работе!");
});
