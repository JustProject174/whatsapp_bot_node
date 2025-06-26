require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const BASE_URL = `https://api.green-api.com/waInstance${process.env.ID_INSTANCE}`;
const API_TOKEN = process.env.API_TOKEN_INSTANCE;

const sendMessage = async (chatId, text) => {
  await axios.post(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
    chatId,
    message: text,
  });
};

const sendButtons = async (chatId, message, buttons) => {
  const formattedButtons = buttons.map((text, index) => ({
    buttonId: `btn_${index + 1}`,
    buttonText: { displayText: text },
    type: 1,
  }));

  await axios.post(`${BASE_URL}/sendButtons/${API_TOKEN}`, {
    chatId,
    message,
    buttons: formattedButtons,
  });
};

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const chatId = body?.body?.senderData?.chatId;

    if (chatId) {
      await sendMessage(chatId, 'ЗДЕСЬ БУДЕТ ПРИВЕТСТВЕННЫЙ ТЕКСТ');

      await sendButtons(chatId, 'Выберите вариант 1:', ['Кнопка 1', 'Кнопка 2', 'Кнопка 3']);
      await sendButtons(chatId, 'Выберите вариант 2:', ['Кнопка 4', 'Кнопка 5', 'Кнопка 6']);
      await sendMessage(chatId, 'Кнопка 7');
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Ошибка в webhook:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Сервер запущен на порту ${PORT}`));
