import os
from datetime import datetime
import logging
import traceback
from enum import Enum
from aiofile import async_open
import asyncio
import uuid
import ujson
import aiohttp
from aiosmtplib import SMTP
from email.mime.text import MIMEText

_HomeFolder = os.path.expanduser('~')
_ModuleName = 'SERVICE'
logging.basicConfig(format='%(message)s')

class _LogType(str, Enum):
    Info=       'INFO '
    Warn=       'WARN '
    Error=      'ERROR'
    Critical=   '*CRITICAL*'    

def set_module_name(name):
    global _ModuleName
    _ModuleName = name
    
async def _send_email(text:str, sid:str=None):
    if not ('ADMIN_EMAIL' in os.environ):
        return
    try:
        admin_email = os.environ['ADMIN_EMAIL']
        sender_email = os.environ['SENDER_GMAIL']
        sender_email_password = os.environ['SENDER_GMAIL_PASSWORD']
        
        msg = MIMEText(text, 'plain')
        msg['References'] = f'<{str(uuid.uuid4())}>'
        msg['From'] = sender_email
        msg['To'] = admin_email
        msg['Subject'] = _ModuleName + ' error'

        mail = SMTP(hostname='smtp.gmail.com', port=587, start_tls=True)
        await mail.connect()
        await mail.ehlo()
        await mail.login(sender_email, sender_email_password)
        await mail.sendmail(sender_email, admin_email, msg.as_string())
        mail.close()
    except:
        logging.error(_format(_LogType.Critical, "Can't send e-mail to admin: " + traceback.format_exc(), sid))

async def _write(text, sid=None):
    f = None
    if not ('LOG_FILENAME' in os.environ):
        return
    try:
        filename = os.path.join(_HomeFolder, os.environ['LOG_FILENAME'])
        f = await async_open(filename, "a")
        await f.write(text + '\n')
    except:
        logging.error(_format(_LogType.Critical, f"Can't write error log to {filename}: " + traceback.format_exc(), sid))
    if f is not None:
        await f.close() # flush

async def _say_telegram(text:str, sid=None):
    if not ('TELEGRAM_BOT_TOKEN' in os.environ):
        return
    try:
        if not ('TELEGRAM_CHAT_ID' in os.environ):
            raise Exception('TELEGRAM_CHAT_ID env variable is not defined')
    
        #const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});
        #await bot.sendMessage(String(process.env.TELEGRAM_BOT_TOKEN), text);
        async with aiohttp.ClientSession(json_serialize=ujson.dumps) as session:
            await session.post(f"https://api.telegram.org/bot{str(os.environ['TELEGRAM_BOT_TOKEN'])}/sendMessage", params={'chat_id':str(os.environ['TELEGRAM_CHAT_ID']), 'text':text})

    except:
        logging.error(_format(_LogType.Critical, "Can't send error on Telegram: " + traceback.format_exc(), sid))

def _format(stype, msg, sid=None):
    while len(msg) and msg[-1]=='\n':
        msg=msg[:-1]
    d = datetime.now()
    sd = d.strftime('[%Y-%m-%d %H:%M:%S.') + f'{int(d.microsecond/1000):03d}]'
    ssid = f'[{sid}]' if sid is not None else ':'
    return f'[{_ModuleName}]{sd} {stype} {str(ssid)} {str(msg)}'

def info(msg, sid=None):
    text = _format(_LogType.Info, msg, sid)
    logging.log(text)
    asyncio.run(_write(text, sid))
    
def warn(msg, sid=None):
    text = _format(_LogType.Warn, msg, sid)
    logging.log(text)
    asyncio.run(_write(text, sid))

def error(msg:str, sid:str=None):
    #text = _format(LogType.Error, msg.stack if msg.stack is not None else msg, sid)
    text = _format(_LogType.Error, msg, sid)
    logging.error(text)

    async def tasks():
        pwrite = asyncio.create_task(_write(text, sid))
        psend = asyncio.create_task(_send_email(text, sid))
        pbot = asyncio.create_task(_say_telegram(text, sid))

        await asyncio.gather(pwrite, psend, pbot)

    asyncio.run(tasks())
