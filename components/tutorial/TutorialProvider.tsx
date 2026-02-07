'use client'

import { useEffect, useState } from 'react'
import { driver, DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/app/tutorial.css'
import { TUTORIAL_STEPS, hasSeenTutorial, markTutorialAsCompleted } from '@/lib/tutorial/tutorial-config'

/**
 * Провайдер туториала для новых пользователей
 * 
 * Автоматически запускает туториал при первом посещении.
 * Использует localStorage для отслеживания состояния.
 */
export function TutorialProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        // Проверяем, нужно ли показать туториал
        if (!hasSeenTutorial()) {
            // Небольшая задержка, чтобы страница успела загрузиться
            const timeout = setTimeout(() => {
                startTutorial()
            }, 1000)

            return () => clearTimeout(timeout)
        }
    }, [mounted])

    return <>{children}</>
}

/**
 * Запускает туториал
 * Можно вызвать из любого места приложения
 */
export function startTutorial(customSteps?: DriveStep[]) {
    const driverObj = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: customSteps || TUTORIAL_STEPS,

        // Настройки внешнего вида
        popoverClass: 'premium-tutorial',
        progressText: 'Шаг {{current}} из {{total}}',

        // Тексты кнопок на русском
        nextBtnText: 'Далее →',
        prevBtnText: '← Назад',
        doneBtnText: 'Завершить ✓',

        // Callbacks
        onDestroyStarted: () => {
            // Отмечаем туториал как пройденный при закрытии
            markTutorialAsCompleted()
            driverObj.destroy()
        },

        onDestroyed: () => {
            markTutorialAsCompleted()
        },

        // Плавная анимация
        animate: true,

        // Разрешить взаимодействие с подсвеченным элементом
        allowClose: true,

        // Тюнинг отступов для красоты
        stagePadding: 5,   // Отступ вокруг подсвеченного элемента
        popoverOffset: 12, // Расстояние от элемента до подсказки
        overlayOpacity: 0.75, // Прозрачность фона
    })

    driverObj.drive()
}
