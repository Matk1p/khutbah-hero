const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
const CONFIG = require('./config');
const { get } = require('http');

const token = CONFIG.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
let chatId;

// async function getChatId() {
//     try {
//         const response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`);
//         const updates = response.data.result;
//         console.log('Updates:', updates);
//         updates.forEach(update => {
//             if (update.message) {
//                 chatId = update.message.chat.id;
//                 const chatTitle = update.message.chat.title || update.message.chat.username || update.message.chat.first_name;
//                 console.log(`Chat ID: ${chatId}, Chat Title: ${chatTitle}`);
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching updates:', error);
//     }
// }

async function getChatId() {
    try {
        fetch(`https://api.telegram.org/bot${token}/getUpdates`)
            .then(response => response.json())
            .then(data => {
                const updates = data.result;
                console.log('Updates:', updates);
                updates.forEach(update => {
                    if (update.message) {
                        chatId = update.message.chat.id;
                        const chatTitle = update.message.chat.title || update.message.chat.username || update.message.chat.first_name;
                        console.log(`Chat ID: ${chatId}, Chat Title: ${chatTitle}`);
                    }
                });
            });
    } catch (error) {
        console.error('Error fetching updates:', error);
    }
}

const stateFile = './state.json';

function hasAlreadySent() {
    if (fs.existsSync(stateFile)) {
        let state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        return state.lastSent === new Date().toISOString().slice(0, 10);
    }
    return false;
}

function markAsSent() {
    let state = { lastSent: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
}

async function getKhutbah() {
    // launch the browser without opening the window
    if (hasAlreadySent()) {
        console.log('Khutbah already sent today');
        return;
    }

    
    let chromeOptions = new chrome.Options();
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    try {
        await driver.get(CONFIG.MUIS_KHUTBAH_URL);
        await driver.sleep(2000);

        let pdfElement = await driver.findElement(By.xpath('//*[@id="results"]/div[2]/div[1]/p/a'));
        let pdfUrl = await pdfElement.getAttribute('href');
        let pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        await driver.sleep(2000);
        let pdfPath = './khutbah.pdf';

        fs.writeFileSync(pdfPath, pdfResponse.data);
        console.log('Khutbah downloaded successfully');
        return pdfPath;

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        // close the browser
        await driver.quit();
    }

}

async function sendPDF(pdfPath) {
    if (!chatId) {
        console.error('Chat ID is not set. Please ensure getChatId() has been called and completed.');
        return;
    }

    try {
        await bot.sendDocument(chatId, pdfPath);
        console.log('PDF sent successfully');
        markAsSent();
    } catch (error) {
        console.error('Error sending PDF:', error);
    } finally {
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }
    }
}


async function runBot() {
    if (hasAlreadySent()) {
        console.log('PDF already sent today.');
        return;
    }

    await getChatId();
    const pdfPath = await getKhutbah();
    if (pdfPath) {
        await sendPDF(pdfPath);
    }
}

runBot();