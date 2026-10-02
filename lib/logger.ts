import { getHondurasTimestamp } from './timezone'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'http'

interface LogContext {
  [key: string]: unknown
}

class SimpleLogger {
  private level: LogLevel

  constructor() {
    this.level =
      (process.env.LOG_LEVEL as LogLevel) ||
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'http', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: getHondurasTimestamp(),
      level,
      message,
      ...context,
      env: process.env.NODE_ENV || 'development',
      service: 'profe-app',
      ...(process.env.RAILWAY_ENVIRONMENT && {
        railway: process.env.RAILWAY_ENVIRONMENT,
      }),
    }

    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry)
    }

    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
  }

  private writeLog(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return
    const formatted = this.formatLog(level, message, context)
    if (level === 'error') console.error(formatted)
    else if (level === 'warn') console.warn(formatted)
    else console.log(formatted)
  }

  debug(message: string, context?: LogContext) {
    this.writeLog('debug', message, context)
  }
  info(message: string, context?: LogContext) {
    this.writeLog('info', message, context)
  }
  warn(message: string, context?: LogContext) {
    this.writeLog('warn', message, context)
  }
  error(message: string, context?: LogContext) {
    this.writeLog('error', message, context)
  }
  http(message: string, context?: LogContext) {
    this.writeLog('http', message, context)
  }
}

export const logger = new SimpleLogger()
