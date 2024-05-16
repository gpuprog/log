"use strict";
const nodemailer = require('nodemailer');
const {randomUUID} = require('node:crypto');
const path = require('node:path'); 
const {homedir} = require('node:os');
const {writeFileSync} = require('node:fs');
//const {writeFile} = require('node:fs/promises');
const axios = require('axios'); //const Bot = require('node-telegram-bot-api');
const sp = require('synchronized-promise');

const HomeFolder = homedir();
const WriteFileParams = {encoding:"utf8", flag:'a', flush:true};
var ModuleName = "SERVICE";
var LogTimeoutMs = 3000;

const LogType = {
    Info:       'INFO ',
    Warn:       'WARN ',
    Error:      'ERROR',
    Critical:   '*CRITICAL*'
}

function set_module_name(name) {
    ModuleName = name;
}

function set_log_timeout_ms(timeout) {
    LogTimeoutMs = timeout;
}

function pad(num, len=2) {
    return num.toString().padStart(len,'0');
}

function format(type, msg, sid=undefined) {
    const d = new Date(); // More complex solution is: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Text_formatting#date_and_time_formatting
    const sd = `[${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}]`;
    const ssid = sid ? `[${String(sid)}]` : ':';
    return `[${ModuleName}]${sd} ${type} ${ssid} ${String(msg)}\n`;
}

function write(text, sid=undefined) {
    if(!process.env.LOG_FILENAME)
        return;
    try {
        writeFileSync(path.join(HomeFolder, process.env.LOG_FILENAME), text, WriteFileParams);
    }
    catch(e) {
        console.error(format(LogType.Critical, "Can't write error log: " + e.toString(), sid));
    }
}

function info(msg, sid=undefined) {
    let text = format(LogType.Info, msg, sid);
    console.log(text);
    write(text, sid);
}

function warn(msg, sid=undefined) {
    let text = format(LogType.Warn, msg, sid);
    console.warn(text);
    write(text, sid);
}

function error(msg, sid=undefined) {
    let text = format(LogType.Error, msg.stack ? msg.stack : String(msg), sid);
    console.error(text);

    let pwrite = new Promise(resolve => {
        write(text, sid);
        resolve();
    });

    let pbot = new Promise(async (resolve) => {
        if(process.env.TELEGRAM_BOT_TOKEN)
        {
            try {
                if(!process.env.TELEGRAM_CHAT_ID)
                    throw new Error('TELEGRAM_CHAT_ID env variable is not defined');
            
                //const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});
                //await bot.sendMessage(String(process.env.TELEGRAM_BOT_TOKEN), text);
                let url = `https://api.telegram.org/bot${String(process.env.TELEGRAM_BOT_TOKEN)}/sendMessage`;
                let chat_id = String(process.env.TELEGRAM_CHAT_ID);
                try {
                    let mtext = text.replaceAll('_','\\_').replaceAll('[','\\[');
                    await axios.post(url, {'chat_id': chat_id, 'text':mtext, 'parse_mode':'Markdown'});
                }
                catch(e) {
                    console.warn(`Can't send Markdown on Telegram: ${e.response && e.response.data && e.response.data.description ? e.response.data.description : (e.message?e.message:String(e))}`);
                    try {
                        await axios.post(url, {'chat_id': chat_id, 'text':text});
                    }
                    catch(e) {
                        if(e.response && e.response.data && e.response.data.description)
                            throw Error(e.response.description);
                        throw e;
                    }
                }
            }
            catch(e) {
                console.error(format(LogType.Critical, "Can't send error on Telegram: " + e.toString(), sid));
            }
        }
        resolve();
    });

    let psend = new Promise(async (resolve) => {
        if(process.env.ADMIN_EMAIL) {
            try {
                if(!process.env.SENDER_GMAIL)
                    throw new Error('SENDER_GMAIL env variable is not defined');
                if(!process.env.SENDER_GMAIL_PASSWORD)
                    throw new Error('SENDER_GMAIL_PASSWORD env variable is not defined');
    
                const transporter = nodemailer.createTransport({
                    service: "Gmail",
                    auth: {
                        user: process.env.SENDER_GMAIL,
                        pass: process.env.SENDER_GMAIL_PASSWORD
                    }
                });
                
                const mailOptions = {
                    from: process.env.SENDER_GMAIL,
                    to: process.env.ADMIN_EMAIL,
                    subject: ModuleName + " error",
                    text: text,
                    headers: { References: randomUUID() }
                };

                await transporter.sendMail(mailOptions);
            }
            catch(e) {
                console.error(format(LogType.Critical, "Can't send e-mail to admin: " + e.toString(), sid));
            }
        }
        resolve();
    });

    // In some cases process can be killed without await promises; to have log.error() be finished and not async we are using sp library
    // For example, Twilio dev: see node_modules\@twilio\runtime-handler\dist\dev-runtime\route.js forked.kill() and node_modules\@twilio\runtime-handler\dist\dev-runtime\internal\functionRunner.js process.send()
    try {
        (sp(()=>{return Promise.all([ pwrite, psend, pbot ])}, {timeouts: LogTimeoutMs}))();
    }
    catch(e) {
        console.error(format(LogType.Critical, "Logger error: " + e.toString(), sid));
    }
}

exports.info = info;
exports.warn = warn;
exports.error = error;
exports.set_module_name = set_module_name;
exports.set_log_timeout_ms = set_log_timeout_ms;
