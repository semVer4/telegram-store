require('dotenv').config();
const serviceAccount = require("./serviceAccountKey.json");
const admin = require('firebase-admin');
const TelegramBot = require('node-telegram-bot-api');

const token = '1089191013:AAES4pnsKnmey8hxr4v58bLOeVf3T9P1Fss'; 
const bot = new TelegramBot(token, { polling: true });

const { v4: uuidv4 } = require('uuid');
const uid = uuidv4(); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
  
const auth = admin.auth();

const db = admin.firestore();
const productsRef = db.collection('products');
const profileRef = db.collection('users');

const emailUser = [];
bot.onText(/\/register (.+) (.+)/, (msg, match) => {
    emailUser.length = 0;

    const email = match[1];
    const password = match[2];

    auth.createUser({
      uid: uid,
      email,
      password,
    })
      .then((userRecord) => {
        bot.sendMessage(msg.chat.id, `Пользователь ${email} успешно зарегистрирован!`);
      })
      .catch((error) => {
        console.error('Error creating user:', error);
        bot.sendMessage(msg.chat.id, 'При регистрации произошла ошибка!');
    });
});

bot.onText(/\/login (.+) (.+)/, (msg, match) => {
    emailUser.length = 0;

    const email = match[1];
    const password = match[2];
  
    emailUser.push(match[1]);

    auth.getUserByEmail(email, password)
      .then((userRecord) => {
        bot.sendMessage(msg.chat.id, `Вы успешно авторизовались как ${email}!`);
      })
      .catch((error) => {
        console.error('Error logging in user:', error);
        bot.sendMessage(msg.chat.id, 'При авторизации произошла ошибка!');
    });
});

const getProducts = async () => {
  try {
    const productsSnapshot = await productsRef.get();

    if (productsSnapshot.empty) {
      throw new Error('Нет доступных товаров');
    }

    const products = [];
    productsSnapshot.forEach((doc) => {
      const product = doc.data();
      products.push(product);
    });

    return products;
  } catch (error) {
    console.error('Ошибка при получении товаров из Firestore:', error);
    throw error;
  }
};

bot.onText(/\/products/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const products = await getProducts();

    // Отправка карточек товаров в чат
    products.forEach((product) => {
      const message = `
        *Название:* ${product.title}
        *Цена:* ${product.price}
        *Описание:* ${product.description}
      `;
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Подробнее',
                callback_data: `details_${product.id}`,
              },
            ],
          ],
        },
      };

      bot.sendPhoto(chatId, product.image, {
        caption: message,
        ...options,
      });
    });
  } catch (error) {
    // Обработка ошибки
    bot.sendMessage(chatId, 'Ошибка при получении товаров');
  }
});

const getProfile = async (userId) => {
  try {
    const userRef = db.collection('pGames').doc(userId);
    const userSnapshot = await userRef.get();

    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      if (userData.cart && userData.cart.length > 0) {
        return userData.cart;
      } else {
        throw new Error('У пользователя нет товаров');
      }
    } else {
      throw new Error('Пользователь не найден');
    }
  } catch (error) {
    console.error('Ошибка при получении товаров пользователя:', error);
    throw error;
  }
};

bot.onText(/\/profile/, async (msg) => {
  if (emailUser != '') {
    const userId = (await auth.getUserByEmail(emailUser[0])).uid;
    console.log(userId);
    try {
      const userProducts = await getProfile(userId);
  
      let response = 'Товары пользователя:\n';
      userProducts.forEach((product) => {
        response += `Название: ${product.title}`;
      });
      bot.sendMessage(msg.chat.id, response);
    } catch (error) {
      bot.sendMessage(msg.chat.id, 'Ошибка при получении товаров пользователя');
    }
  } else {
    bot.sendMessage(msg.chat.id, 'Авторизуйтесь!');
  }
});