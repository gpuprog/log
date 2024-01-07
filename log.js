const nodemailer = require('nodemailer');
const {randomUUID} = require('node:crypto');
const path = require('node:path'); 
const {homedir} = require('node:os');
const {writeFileSync} = require('node:fs');
//const {writeFile} = require('node:fs/promises');
const axios = require('axios'); //const Bot = require('node-telegram-bot-api');
const sp = require('synchronized-promise');

const LogFileName = path.join(homedir(), "calls.log");
const EmailSubject = 'Twilio issue';

WriteFileParams = {encoding:"utf8", flag:'a', flush:true};

const LogType = {
    Info:       'INFO ',
    Error:      'ERROR',
    Critical:   '*CRITICAL*'
}

function pad(num, len=2) {
    return num.toString().padStart(len,'0');
}

function format(type, msg, sid=undefined) {
    const d = new Date(); // More complex solution is: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Text_formatting#date_and_time_formatting
    const sd = `[${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}]`;
    const ssid = sid ? `[${String(sid)}]` : ':';
    return `[TWILIO]${sd} ${type} ${ssid} ${String(msg)}\n`;
}

function write(text, sid=undefined) {
    try {
        writeFileSync(LogFileName, text, WriteFileParams);
    }
    catch(e) {
        console.error(format(LogType.Critical, "Can't write error log: " + e.toString(), sid));
    }
}

function info(msg, sid=undefined) {
    text = format(LogType.Info, msg, sid);
    console.log(text);
    write(text, sid);
}

function error(msg, sid=undefined) {    
    text = format(LogType.Error, msg.stack ? msg.stack : String(msg), sid);
    console.error(text);
    pwrite = new Promise(resolve => {
        write(text, sid);
        resolve();
    });

    pbot = new Promise(async (resolve) => {
        if(process.env.TELEGRAM_BOT_TOKEN)
        {
            try {
                if(!process.env.TELEGRAM_CHAT_ID)
                    throw new Error('TELEGRAM_CHAT_ID env variable is not defined');
            
                //const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});
                //await bot.sendMessage(String(process.env.TELEGRAM_BOT_TOKEN), text);
                await axios.post(`https://api.telegram.org/bot${String(process.env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {'chat_id': String(process.env.TELEGRAM_CHAT_ID), 'text':text});
            }
            catch(e) {
                console.error(format(LogType.Critical, "Can't send error on Telegram: " + e.toString(), sid));
            }
        }
        resolve();
    });

    psend = new Promise(async (resolve) => {
        try {
            if(!process.env.SENDER_GMAIL)
                throw new Error('SENDER_GMAIL env variable is not defined');
            if(!process.env.SENDER_GMAIL_PASSWORD)
                throw new Error('SENDER_GMAIL_PASSWORD env variable is not defined');
            if(!process.env.ADMIN_EMAIL)
                throw new Error('ADMIN_EMAIL env variable is not defined');

            const transporter = nodemailer.createTransport({
                service: "Gmail",
                //host: 'smtp.gmail.com',
                //port: 587,
                //logger: true, debug:true,
                auth: {
                    user: process.env.SENDER_GMAIL,
                    pass: process.env.SENDER_GMAIL_PASSWORD
                }
            });
            
            const mailOptions = {
                from: process.env.SENDER_GMAIL,
                to: process.env.ADMIN_EMAIL,
                subject: EmailSubject,
                text: text,
                headers: { References: randomUUID() }
            };
                
            await transporter.sendMail(mailOptions);
        }
        catch(e) {
            console.error(format(LogType.Critical, "Can't send e-mail to admin: " + e.toString(), sid));
        }
        resolve();
    });

    // The Twilio engine kills process without await promises; to have log.error() be finished and not async we using sp library
    // See node_modules\@twilio\runtime-handler\dist\dev-runtime\route.js forked.kill() and node_modules\@twilio\runtime-handler\dist\dev-runtime\internal\functionRunner.js process.send()
    // Note: use functions instead promises to individually control throws
    (sp(()=>{return Promise.all([ pwrite, psend, pbot ])}))();
}

exports.info = info;
exports.error = error;
