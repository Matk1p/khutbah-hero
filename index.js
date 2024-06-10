const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
const CONFIG = require('./config');
const { get } = require('http');

const downloadDir = path.resolve(__dirname, 'downloads');
const token = CONFIG.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

async function getKhutbah(downloadDir) {
    // launch the browser without opening the window
    let chromeOptions = new chrome.Options()
        .setUserPreferences({
            'download.default_directory': downloadDir,
            'download.prompt_for_download': false,
            'download.directory_upgrade': true,
        })
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    try {
        await driver.get(CONFIG.MUIS_KHUTBAH_URL);
        await driver.sleep(2000);

        let downloadKhutbahButton = await driver.findElement(By.xpath('//*[@id="results"]/div[2]/div[1]/p/a'));
        var khutbahPdf = await downloadKhutbahButton.click();
        await driver.sleep(2000);
        console.log('Khutbah downloaded successfully');

        // const files = fs.readdirSync(downloadDir);
        // const pdfFile = files.find(file => file.endsWith('.pdf'));
        return khutbahPdf;
        
    } catch (e) {
        console.error(e);
    } finally {
        // close the browser
        await driver.quit();
    }

}

// Telegram bot command to download and send the PDF
bot.onText(/\/download (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1]; // URL from the command

    bot.sendMessage(chatId, 'Downloading PDF, please wait...');

    try {
        const pdfPath = await getKhutbah();

        // Send the downloaded PDF to the user
        bot.sendDocument(chatId, pdfPath);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        bot.sendMessage(chatId, 'Failed to download PDF.');
    }
});


// Telegram bot command to send the PDF
bot.onText(/\/send/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Sending PDF, please wait...');

    try {
        // Send the PDF to the user
        bot.sendDocument(chatId, getKhutbah(downloadDir));
        bot.sendMessage(chatId, 'PDF sent successfully.');
    } catch (error) {
        console.error('Error sending PDF:', error);
        bot.sendMessage(chatId, 'Failed to send PDF.');
    }
});

