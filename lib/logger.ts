type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
    private format(level: LogLevel, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const runtime = process.env.NEXT_RUNTIME || 'browser';
        return `[${timestamp}] [${runtime}] [${level.toUpperCase()}]: ${message} ${data ? JSON.stringify(data, null, 2) : ''}`;
    }

    info(message: string, data?: any) {
        console.log(this.format('info', message, data));
    }

    warn(message: string, data?: any) {
        console.warn(this.format('warn', message, data));
    }

    error(message: string, data?: any) {
        // Здесь можно интегрировать Sentry или другой сервис мониторинга
        console.error(this.format('error', message, data));
    }

    debug(message: string, data?: any) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(this.format('debug', message, data));
        }
    }
}

export const logger = new Logger();
