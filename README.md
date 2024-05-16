# Purpose
This log module can be used in microservices on JS and Python to write common (combined, or single) log file and also to notify administrator about errors.
The module provides similar format for different microservices and single configuration point (environment variables) that can be useful on server with SaaS b ased on different microservices.

# How to use
## Configuration in code
In code it's recommended to set module name with a call: `log.set_module_name(name)`.

## Session identificator (sid)
Sid is any (optional) string that can identify the session.

## Log format
Any message has common format like:
`[module][datetime] level [sid] message`
Where:
- `module` - configurable name
- `datetime` - date and time of log call by format YYYY-MM-DD hh:mm:ss.ms
- `level` - level of message, `INFO`, `WARN`, `ERROR` (and internal `*CRITICAL*` for logger internal errors)
- `sid` - Session identificator (can be undefined/None)

## Logging (by levels)
To log any message use following functions by appropriate levels (sid is optional argument):
- `log.info(message, sid)`
- `log.warn(message, sid)`
- `log.error(message, sid)`
> Levels "info" and "warn" logged into stdout and log file only but level "error" also generates e-mail and Telegram message.

# External configuration
The logger configured with environment variables. Additionally to always enabled stdout/stderr you can enable up to three channels for logging by following variables:
- Log all levels of messages to file (can be used from different processes in parallel)
    - `LOG_FILENAME=<Filename for .log in HOME folder>`
- Send e-mail per each error level message (with call stack)
    - `SENDER_GMAIL=<Your Gmail proxy account to send e-mails>`
    - `SENDER_GMAIL_PASSWORD=<Your Gmail proxy account app password>` - see [how to configure Gmail app password](https://support.google.com/mail/answer/185833?hl=en#:~:text=Under%20%22Signing%20in%20to%20Google,Select%20Generate.)
    - `ADMIN_EMAIL=<Admin e-mail to get critical error messages>`
- Send Telegram notification per each error-level message (with call stack) - see [how to get Telegram the Bot Token and the Chat ID](https://docs.influxdata.com/kapacitor/v1/reference/event_handlers/telegram/#telegram-setup)
    - `TELEGRAM_BOT_TOKEN=<Your Telegram bot token>`
    - `TELEGRAM_CHAT_ID=<The chat ID to send messages>`

# Integration
Recommended way for integration is to use it as git submodule - to update it for your requirements.
- Python: [PyPi package](https://pypi.org/project/gpuprog-log/) - use `pip install gpuprog-log`
> `import log`
- JS: [NPM package](https://www.npmjs.com/package/@gpuprog/log) - use `npm i @gpuprog/log`
> `const log = require('@gpuprog/log/log')`

# Development
`cd log`
- JS: [Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
`npm publish --access public`
- Python: [Packaging Python Projects](https://packaging.python.org/en/latest/tutorials/packaging-projects/)
`python -m build`
`python -m twine upload --repository pypi dist/*`
