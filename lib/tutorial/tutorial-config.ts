import { DriveStep } from 'driver.js'

/**
 * Конфигурация туториала для новых пользователей
 * 
 * ВАЖНО: Включать только элементы, которые ВСЕГДА видны и доступны!
 */

export const TUTORIAL_STEPS: DriveStep[] = [
  // 1. Приветствие
  {
    popover: {
      title: '👋 Добро пожаловать в AI News Control Center!',
      description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Система автоматизации публикаций в соцсети с помощью искусственного интеллекта.</p>
          <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">🚀 Что умеет система:</p>
            <ul class="text-sm space-y-2 text-emerald-600 dark:text-emerald-400">
              <li class="flex items-start gap-2">
                <span class="text-lg">✨</span>
                <span>AI адаптирует тексты под каждую соцсеть автоматически</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">⏰</span>
                <span>Планирование публикаций на любое время</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">📊</span>
                <span>Управление всеми постами в одном месте</span>
              </li>
            </ul>
          </div>
        </div>
      `,
      side: 'bottom',
      align: 'center'
    }
  },

  // Steps 2-4 remain as is
  {
    element: '[data-tutorial="sidebar-drafts"]',
    popover: {
      title: '📝 Черновики',
      description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Здесь вы найдете все новости в работе.</p>
          <div class="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
            <p class="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">🎯 Возможности раздела:</p>
            <ul class="text-sm space-y-2 text-blue-600 dark:text-blue-400">
              <li class="flex items-start gap-2">
                <span class="text-lg">✏️</span>
                <span>Редактировать контент перед публикацией</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">🧠</span>
                <span>AI создаст адаптации для всех соцсетей</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">📸</span>
                <span>Добавить изображения и медиа</span>
              </li>
            </ul>
          </div>
        </div>
      `,
      side: 'right',
      align: 'start'
    }
  },

  {
    element: '[data-tutorial="sidebar-settings"]',
    popover: {
      title: '⚙️ Настройки',
      description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Конфигурация AI моделей, платформ и интеграций.</p>
          
          <div class="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800">
            <p class="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2">🔧 Что настраивается:</p>
            <ul class="text-sm space-y-2 text-amber-600 dark:text-amber-400">
              <li class="flex items-start gap-2">
                <span class="text-lg">🤖</span>
                <span>Модели AI для генерации текстов</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">🔗</span>
                <span>Подключение соцсетей и каналов</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">🎨</span>
                <span>Темы оформления и интерфейс</span>
              </li>
            </ul>
          </div>
        </div>
      `,
      side: 'left',
      align: 'start'
    }
  },

  // 4. Завершение
  {
    popover: {
      title: '🎉 Готово! Начинайте работу',
      description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Теперь вы знаете основы работы с системой!</p>
          
          <div class="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3">💡 Полезные советы:</p>
            <ul class="text-sm space-y-2 text-emerald-600 dark:text-emerald-400">
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>В редакторе используйте вкладку <strong>"Площадки"</strong> для AI адаптации</span>
              </li>
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Кнопка <strong>"Сгенерировать всё"</strong> создаст тексты для всех соцсетей сразу</span>
              </li>
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Наведите курсор на любую иконку — везде есть подсказки!</span>
              </li>
            </ul>
          </div>

          <div class="text-center pt-3 border-t-2 border-border/40">
            <p class="text-xs text-muted-foreground">Чтобы пройти туториал снова, нажмите на иконку <strong class="text-foreground">помощи (?)</strong> в навигации</p>
          </div>
        </div>
      `,
      side: 'bottom',
      align: 'center'
    }
  }
]

/**
 * Шаги туториала для главной страницы публикаций (динамические)
 */
export const getPublicationsTutorialSteps = (
  onTabChange: (tab: 'drafts' | 'board' | 'calendar') => void,
  onOpenCreateDialog?: () => void
): DriveStep[] => [
    {
      popover: {
        title: '👋 Добро пожаловать в раздел Публикации!',
        description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Здесь находится центр управления всем вашим контентом.</p>
          <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">📋 Три способа просмотра:</p>
            <ul class="text-sm space-y-2 text-emerald-600 dark:text-emerald-400">
              <li class="flex items-start gap-2">
                <span class="text-lg">📝</span>
                <span><strong>Черновики</strong> — новости в работе</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">📊</span>
                <span><strong>Доска</strong> — статусы публикаций</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-lg">📅</span>
                <span><strong>Календарь</strong> — расписание постов</span>
              </li>
            </ul>
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="publications-tabs"]',
      popover: {
        title: '🗂 Переключение режимов',
        description: 'Эти вкладки помогут вам работать с контентом в разных форматах. Вы можете перетаскивать их для удобства!',
        side: 'bottom',
        align: 'center'
      }
    },

    // =============== ЧЕРНОВИКИ ===============
    {
      element: '[data-tutorial="publications-tabs"]',
      popover: {
        title: '📝 Черновики',
        description: 'Сейчас откроем вкладку "Черновики". Здесь находятся все новости, которые вы создаете и редактируете.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('drafts')
    },

    {
      element: '[data-tutorial="publications-board"]',
      popover: {
        title: '✍️ Работа с черновиками',
        description: 'В этом разделе вы видите список всех черновиков. Кликните на любой, чтобы открыть редактор и доработать контент.',
        side: 'top',
        align: 'start'
      },
      onHighlightStarted: () => onTabChange('drafts')
    },

    // =============== ДОСКА ===============
    {
      element: '[data-tutorial="publications-tabs"]',
      popover: {
        title: '📊 Доска публикаций',
        description: 'Переходим к доске. Здесь вы отслеживаете статусы всех публикаций в стиле Kanban.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('board')
    },

    {
      element: '[data-tutorial="board-filter-tags"]',
      popover: {
        title: '🏷 Фильтры по тегам',
        description: 'Нажмите сюда, чтобы выбрать теги (EDC, Survival, Camping и др.). Можно выбрать несколько одновременно для точного поиска.',
        side: 'bottom',
        align: 'start'
      },
      onHighlightStarted: () => onTabChange('board')
    },

    {
      element: '[data-tutorial="board-filter-status"]',
      popover: {
        title: '📊 Фильтры по статусу',
        description: `
        <div class="space-y-2">
          <p class="text-sm">Отслеживайте состояние публикаций:</p>
          <ul class="text-xs space-y-1">
            <li>🔵 <strong>Запланировано</strong> — в очереди на публикацию</li>
            <li>🟡 <strong>Частично</strong> — опубликовано не везде</li>
            <li>🟢 <strong>Опубликовано</strong> — успешно разослано</li>
            <li>🔴 <strong>Ошибки</strong> — требуют внимания</li>
          </ul>
        </div>
      `,
        side: 'bottom',
        align: 'start'
      },
      onHighlightStarted: () => onTabChange('board')
    },

    {
      element: '[data-tutorial="board-sort"]',
      popover: {
        title: '⏰ Сортировка постов',
        description: `
        <p class="text-sm mb-2">Два режима сортировки:</p>
        <ul class="text-sm space-y-1">
          <li><strong>По дате</strong> — по времени публикации (от ранних к поздним)</li>
          <li><strong>Создано</strong> — по времени создания (от новых к старым)</li>
        </ul>
      `,
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('board')
    },

    {
      element: '[data-tutorial="publications-board"]',
      popover: {
        title: '🎨 Карточки публикаций',
        description: 'Каждая карточка — это группа постов для разных площадок. Кликните на карточку, чтобы открыть редактор контента.',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('board')
    },

    // =============== КАЛЕНДАРЬ ===============
    {
      element: '[data-tutorial="publications-tabs"]',
      popover: {
        title: '📅 Календарь',
        description: 'И последний режим — календарь. Визуализация расписания публикаций по датам.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('calendar')
    },

    {
      element: '[data-tutorial="publications-board"]',
      popover: {
        title: '⏰ Планирование по датам',
        description: `
        <div class="space-y-3">
          <p class="text-sm">Здесь вы видите, какие посты запланированы на каждый день.</p>
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p class="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">💡 Возможности календаря:</p>
            <ul class="text-xs space-y-1 text-blue-600 dark:text-blue-400">
              <li>• Переключение между <strong>месяцем</strong> и <strong>неделей</strong></li>
              <li>• Быстрый выбор нужного месяца через пикер</li>
              <li>• Перетаскивание постов на другие даты</li>
              <li>• Кнопка "Сегодня" для быстрого возврата</li>
            </ul>
          </div>
        </div>
      `,
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('calendar')
    },

    // =============== СОЗДАНИЕ ПОСТА ===============
    {
      element: '[data-tutorial="create-draft-button"]',
      popover: {
        title: '➕ Создание поста',
        description: 'Когда будете готовы создать новый пост, нажмите эту кнопку. Сейчас откроем её для демонстрации!',
        side: 'left',
        align: 'center'
      },
      onHighlightStarted: () => onOpenCreateDialog?.()
    },

    {
      element: '[data-tutorial="create-post-header"]',
      popover: {
        title: '🎨 Форма создания',
        description: 'AI создаст полноценный пост: заголовок, анонс и развернутую статью. Вам нужно лишь задать направление.',
        side: 'bottom',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="create-post-title"]',
      popover: {
        title: '📝 Название *',
        description: `
        <div class="space-y-2">
          <p class="text-sm">Введите название или тему новости. Примеры:</p>
          <ul class="text-xs space-y-1 text-muted-foreground">
            <li>• "Нож Mora Companion Heavy Duty"</li>
            <li>• "Обзор палатки MSR Hubba Hubba"</li>
            <li>• "Лучшие EDC фонарики 2024"</li>
          </ul>
          <p class="text-xs mt-2"><strong>Совет:</strong> Используйте иконку микрофона справа для голосового ввода!</p>
        </div>
      `,
        side: 'bottom',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="create-post-description"]',
      popover: {
        title: '📋 Описание / Заметки',
        description: `
        <div class="space-y-2">
          <p class="text-sm">Опишите подробности, которые AI должен учесть:</p>
          <ul class="text-xs space-y-1">
            <li>• Характеристики и особенности</li>
            <li>• Цена и где купить</li>
            <li>• Личный опыт использования</li>
            <li>• Плюсы и минусы</li>
          </ul>
          <p class="text-xs mt-2 text-muted-foreground">Больше деталей = лучше результат от AI</p>
        </div>
      `,
        side: 'top',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="create-post-photo"]',
      popover: {
        title: '📸 Фото (опционально)',
        description: 'Загрузите изображение товара или предмета. AI использует его при генерации контента и адаптации под соцсети.',
        side: 'top',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="create-post-submit"]',
      popover: {
        title: '🚀 Создать пост',
        description: `
        <div class="space-y-3">
          <p class="text-sm">После нажатия AI:</p>
          <ol class="text-xs space-y-1 list-decimal list-inside">
            <li>Сгенерирует заголовок и структуру</li>
            <li>Создаст полноценный анонс</li>
            <li>Напишет развернутую статью</li>
          </ol>
          <p class="text-xs mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
            <strong>Результат:</strong> Черновик появится в разделе "Черновики"!
          </p>
        </div>
      `,
        side: 'top',
        align: 'end'
      }
    },

    // =============== ЗАВЕРШЕНИЕ ===============
    {
      popover: {
        title: '🎉 Готово!',
        description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Теперь вы знаете, как ориентироваться в публикациях!</p>
          
          <div class="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3">💡 Следующие шаги:</p>
            <ul class="text-sm space-y-2 text-emerald-600 dark:text-emerald-400">
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Создайте свой первый пост через кнопку <strong>"Создать пост"</strong></span>
              </li>
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Откройте любой черновик для полного редактирования</span>
              </li>
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Попробуйте AI-генерацию текстов для разных площадок</span>
              </li>
              <li class="flex items-start gap-2">
                <span>•</span>
                <span>Используйте фильтры на доске для быстрого поиска</span>
              </li>
            </ul>
          </div>

          <div class="text-center pt-3 border-t-2 border-border/40">
            <p class="text-xs text-muted-foreground">Чтобы пройти туториал снова, нажмите на кнопку <strong class="text-foreground">"Помощь"</strong></p>
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    }
  ]

/**
 * Шаги туториала для редактора новостей (динамические)
 */
export const getEditorTutorialSteps = (onTabChange: (tab: string) => void): DriveStep[] => [
  {
    element: '[data-tutorial="editor-header"]',
    popover: {
      title: '📝 Редактор контента',
      description: 'Добро пожаловать в центр управления публикацией. Здесь вы готовите новость к выходу в свет.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '[data-tutorial="editor-tabs"]',
    popover: {
      title: '🗂 Вкладки разделов',
      description: 'Мы пройдем по каждой вкладке по порядку, чтобы ничего не упустить.',
      side: 'bottom',
      align: 'center'
    }
  },
  // 1. ВКЛАДКА "ОСНОВНОЕ"
  {
    element: '[data-tutorial="title-input"]',
    popover: {
      title: '📌 Заголовок',
      description: 'Начнем с главного. Введите заголовок, который зацепит аудиторию.',
      side: 'bottom',
      align: 'start'
    },
    onHighlightStarted: () => onTabChange('main')
  },
  {
    element: '[data-tutorial="announce-input"]',
    popover: {
      title: '📢 Текст анонса',
      description: 'Это "базовый" текст. AI будет использовать его для создания постов в Telegram, VK и другие сети.',
      side: 'top',
      align: 'start'
    },
    onHighlightStarted: () => onTabChange('main')
  },
  {
    element: '[data-tutorial="tags-section"]',
    popover: {
      title: '🏷 Тегирование',
      description: 'Добавьте теги, чтобы система знала, к каким категориям относится новость.',
      side: 'top',
      align: 'start'
    },
    onHighlightStarted: () => onTabChange('main')
  },
  // 2. ВКЛАДКА "СТАТЬЯ"
  {
    element: '[data-tutorial="article-tab"]',
    popover: {
      title: '📜 Полная статья',
      description: 'Теперь перейдем к контенту для сайта.',
      side: 'right',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('longread')
  },
  {
    element: '[data-tutorial="article-content"]',
    popover: {
      title: '✍️ Редактор лонгридов',
      description: 'Здесь находится полный текст статьи. Вы можете форматировать его как угодно.',
      side: 'bottom',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('longread')
  },
  // 3. ВКЛАДКА "МЕДИА"
  {
    element: '[data-tutorial="media-tab"]',
    popover: {
      title: '🖼 Изображения',
      description: 'Посмотрим, что у нас с картинками.',
      side: 'right',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('media')
  },
  {
    element: '[data-tutorial="media-content"]',
    popover: {
      title: '🎨 Визуальный контент',
      description: 'Здесь вы можете сгенерировать обложку с помощью AI или загрузить свою.',
      side: 'bottom',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('media')
  },
  // 4. ВКЛАДКА "ПЛОЩАДКИ"
  {
    element: '[data-tutorial="platforms-tab"]',
    popover: {
      title: '📱 Социальные сети',
      description: 'Самое время адаптировать контент.',
      side: 'left',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('social')
  },
  {
    element: '[data-tutorial="generate-all-button"]',
    popover: {
      title: '🚀 Магия AI',
      description: 'Нажмите "Сгенерировать всё", и система создаст уникальные посты для каждой соцсети одновременно!',
      side: 'bottom',
      align: 'center'
    },
    onHighlightStarted: () => onTabChange('social')
  },
  // ФИНАЛ
  {
    element: '[data-tutorial="reject-button"]',
    popover: {
      title: '🗑 Отклонить',
      description: 'Если новость не подходит, отклоните её. Она пойдёт в архив.',
      side: 'top',
      align: 'center'
    }
  },
  {
    element: '[data-tutorial="save-button"]',
    popover: {
      title: '💾 Сохранить',
      description: 'Когда всё готово, сохраните новость. После этого её можно будет запланировать и опубликовать!',
      side: 'top',
      align: 'end'
    }
  }
]

/**
 * Вспомогательные функции для управления состоянием туториала
 */
export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('tutorial-completed') === 'true'
}

export function markTutorialAsCompleted() {
  if (typeof window === 'undefined') return
  localStorage.setItem('tutorial-completed', 'true')
}

export function resetTutorial() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('tutorial-completed')
}

/**
 * Шаги туториала для страницы модерации (динамические)
 */
export const getModerationTutorialSteps = (
  onFilterChange: (filter: any) => void
): DriveStep[] => [
    {
      popover: {
        title: '🛡 Модерация контента',
        description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Добро пожаловать в "прихожую" вашей системы. Здесь собираются новости, найденные AI в сети.</p>
          <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
            <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">📋 Ваша задача:</p>
            <ul class="text-sm space-y-2 text-emerald-600 dark:text-emerald-400">
              <li>• Просмотреть, что отобрал AI</li>
              <li>• <strong>Одобрить</strong> — новость уйдет в Черновики для публикации</li>
              <li>• <strong>Отклонить</strong> — если новость не интересна</li>
            </ul>
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-hero"]',
      popover: {
        title: '🚀 AI Фильтрация',
        description: 'Система автоматически сканирует сотни источников и отбирает самое релевантное по вашим настройкам.',
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-filters"]',
      popover: {
        title: '📊 Статусы очереди',
        description: `
        <div class="space-y-2">
          <ul class="text-sm space-y-1">
            <li>• <strong>Ожидание</strong> — новые новости от AI</li>
            <li>• <strong>Одобрено</strong> — ваш выбор</li>
            <li>• <strong>Отклонено</strong> — архив мусора</li>
          </ul>
        </div>
      `,
        side: 'bottom',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="moderation-sources"]',
      popover: {
        title: '🔍 Фильтр по источникам',
        description: 'Хотите просмотреть новости только с конкретного сайта? Выберите его здесь.',
        side: 'bottom',
        align: 'start'
      }
    },

    {
      element: '[data-tutorial="moderation-search"]',
      popover: {
        title: '🔎 Быстрый поиск',
        description: 'Ищите по заголовку, тексту или названию сайта прямо на лету.',
        side: 'bottom',
        align: 'end'
      }
    },

    {
      element: '[data-tutorial="moderation-card"]',
      popover: {
        title: '📦 Карточка новости',
        description: 'Давайте разберем, что внутри каждой карточки.',
        side: 'right',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-card-score"]',
      popover: {
        title: '⭐ Оценка AI (0-100)',
        description: 'Насколько эта новость соответствует вашим интересам. Чем выше балл, тем больше шансов на успех!',
        side: 'top',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-card-ai"]',
      popover: {
        title: '🕵️ Почему она здесь?',
        description: 'Краткое пояснение от AI, почему эта новость прошла первичный фильтр.',
        side: 'top',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-card-approve"]',
      popover: {
        title: '✅ Кнопка "Одобрить"',
        description: `
        <p class="text-sm font-bold text-emerald-600 mb-2">Самый важный шаг!</p>
        <p class="text-xs">При нажатии AI:</p>
        <ol class="text-xs space-y-1 list-decimal list-inside mt-2">
          <li>Прочтет оригинал статьи полностью</li>
          <li>Напишет профессиональный лонгрид</li>
          <li>Создаст анонс и заголовок</li>
          <li>Передаст всё в раздел <strong>Черновики</strong></li>
        </ol>
      `,
        side: 'top',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="moderation-card-reject"]',
      popover: {
        title: '❌ Кнопка "Отклонить"',
        description: 'Если новость — спам или не подходит, смело жмите сюда. Она исчезнет из очереди.',
        side: 'top',
        align: 'center'
      }
    },

    {
      popover: {
        title: '🎯 Начинайте модерацию!',
        description: `
        <div class="space-y-4">
          <p class="text-base">Ваша лента готова к работе. Одобрите несколько новостей, чтобы AI начал магию генерации!</p>
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 text-xs">
            <strong>Совет:</strong> Все одобренные новости появятся в разделе "Черновики", где вы сможете их опубликовать.
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    }
  ]

/**
 * Шаги туториала для страницы промптов (динамические)
 */
export const getPromptsTutorialSteps = (
  onTabChange: (tab: string) => void
): DriveStep[] => [
    {
      popover: {
        title: '🧠 Системные промпты',
        description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Это "инструкции по эксплуатации" для вашего AI. Здесь вы определяете стиль, тон и логику генерации контента.</p>
          <div class="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800">
            <p class="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2">⚠️ Важно помнить:</p>
            <ul class="text-sm space-y-2 text-amber-600 dark:text-amber-400">
              <li>• Промпты влияют на <strong>каждый</strong> создаваемый пост</li>
              <li>• Чем точнее инструкция, тем меньше правок в черновиках</li>
              <li>• Изменения вступают в силу мгновенно для новых задач</li>
            </ul>
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="prompts-tabs"]',
      popover: {
        title: '🗂 Категории инструкций',
        description: `
        <div class="space-y-2">
          <ul class="text-sm space-y-1">
            <li>• <strong>Системные</strong> — общие правила и промпты для картинок</li>
            <li>• <strong>Новости/Обзоры</strong> — инструкции для лонгридов</li>
            <li>• <strong>Соцсети</strong> — правила адаптации под каждую площадку</li>
          </ul>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="prompts-card"]',
      popover: {
        title: '📄 Карточка промпта',
        description: 'Каждая карточка содержит один конкретный промпт. Давайте разберем, как с ним работать.',
        side: 'top',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="prompts-card-handle"]',
      popover: {
        title: '↕️ Изменение порядка',
        description: 'Вы можете перетаскивать карточки, чтобы сгруппировать важные промпты сверху. Порядок сохраняется автоматически!',
        side: 'left',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="prompts-card-editor"]',
      popover: {
        title: '✍️ Редактор текста',
        description: 'Здесь вы пишете саму инструкцию. Поле автоматически расширяется под объем вашего текста.',
        side: 'top',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="prompts-card-save"]',
      popover: {
        title: '💾 Сохранение изменений',
        description: 'Не забудьте нажать "Save Changes" после редактирования. Если вы внесли изменения, кнопка станет яркой и активной.',
        side: 'left',
        align: 'center'
      }
    },

    {
      popover: {
        title: '✨ Творите магию!',
        description: `
        <div class="space-y-4">
          <p class="text-base text-center">Теперь вы знаете, как управлять интеллектом вашей системы. Будьте точны в своих желаниях!</p>
          <div class="text-center pt-3 border-t border-border">
             <p class="text-xs text-muted-foreground italic">"Промпт — это заклинание 21 века."</p>
          </div>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    }
  ]

/**
 * Шаги туториала для страницы настройки публикаций (динамические)
 */
export const getRecipesTutorialSteps = (): DriveStep[] => [
  {
    popover: {
      title: '⚙️ Настройка публикаций',
      description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Здесь вы управляете правилами игры: какие каналы активны, в каком порядке они идут и через сколько часов после одобрения новости должна выйти публикация.</p>
        </div>
      `,
      side: 'bottom',
      align: 'center'
    }
  },

  {
    element: '[data-tutorial="recipes-row"]',
    popover: {
      title: '📱 Канал публикации',
      description: 'Каждая строка — это отдельная площадка (Telegram, VK, Вебсайт и др.).',
      side: 'top',
      align: 'center'
    }
  },

  {
    element: '[data-tutorial="recipes-row-handle"]',
    popover: {
      title: '↕️ Приоритет каналов',
      description: 'Перетаскивайте каналы за эту иконку. Порядок важен для внутренней логики отображения в системе.',
      side: 'right',
      align: 'center'
    }
  },

  {
    element: '[data-tutorial="recipes-row-toggle"]',
    popover: {
      title: '🔌 Вкл / Выкл',
      description: 'Быстро включайте или отключайте отправку новостей в конкретный канал без удаления настроек.',
      side: 'left',
      align: 'center'
    }
  },

  {
    element: '[data-tutorial="recipes-row-star"]',
    popover: {
      title: '⭐ Основной канал',
      description: 'Помечает канал как приоритетный. Обычно это ваш Вебсайт или основной Telegram-канал.',
      side: 'left',
      align: 'center'
    }
  },

  {
    element: '[data-tutorial="recipes-row-delay"]',
    popover: {
      title: '⏰ Тайминг (в часах)',
      description: `
        <div class="space-y-2">
          <p class="text-sm">Укажите, через сколько часов после вашего одобрения пост должен быть опубликован.</p>
          <p class="text-xs text-amber-600"><strong>Совет:</strong> Используйте задержку, чтобы распределить посты равномерно в течение дня.</p>
        </div>
      `,
      side: 'left',
      align: 'center'
    }
  },

  {
    popover: {
      title: '🎯 Всё готово к работе!',
      description: `
        <div class="space-y-4">
          <p class="text-base">Настройте тайминги один раз, и система будет автоматически планировать посты по вашему расписанию.</p>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 text-xs text-center">
            <strong>Удачных публикаций!</strong>
          </div>
        </div>
      `,
      side: 'bottom',
      align: 'center'
    }
  }
]

/**
 * Шаги туториала для страницы настроек (Settings Center)
 */
/**
 * Шаги туториала для страницы настроек (Settings Center)
 */
export const getSettingsTutorialSteps = (
  onTabChange: (tab: string) => void
): DriveStep[] => [
    {
      popover: {
        title: '⚙️ Центр Управления',
        description: `
        <div class="space-y-4">
          <p class="text-base leading-relaxed">Добро пожаловать в «мозговой центр» всей системы. Здесь настраиваются ключи доступа, логика работы AI и правила сбора новостей.</p>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="settings-tabs"]',
      popover: {
        title: '📑 Разделы настроек',
        description: 'Все настройки разбиты на 5 логических вкладок: от простых ключей до глубоких логов работы системы.',
        side: 'bottom',
        align: 'center'
      }
    },

    {
      element: '[data-tutorial="settings-tab-ai"]',
      popover: {
        title: '🤖 AI Конфигурация',
        description: 'Здесь настраиваются ключи провайдеров (OpenRouter, OpenAI и др.) и выбираются модели для генерации текстов и картинок.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ai')
    },

    {
      element: '[data-tutorial="settings-ai-keys"]',
      popover: {
        title: '🔑 Ключи провайдеров',
        description: 'Сюда нужно вставить ваши API-ключи. Без них магия AI не сработает.',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ai')
    },

    {
      element: '[data-tutorial="settings-ai-model"]',
      popover: {
        title: '🧠 Выбор «Мозга»',
        description: 'Здесь вы выбираете модель по умолчанию для всей системы. Мы рекомендуем Claude 3.5 Sonnet или GPT-4o.',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ai')
    },

    {
      element: '[data-tutorial="settings-tab-ingestion"]',
      popover: {
        title: '📡 Источники и Сбор',
        description: 'Управление расписанием сканирования интернета и списком ваших RSS-лент или сайтов-доноров.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ingestion')
    },

    {
      element: '[data-tutorial="settings-ingestion-toggle"]',
      popover: {
        title: '🤖 Мастер-выключатель',
        description: 'Этот тумблер полностью останавливает или запускает автоматический поиск новостей по всем вашим источникам.',
        side: 'right',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ingestion')
    },

    {
      element: '[data-tutorial="settings-safe-mode"]',
      popover: {
        title: '🛡️ Безопасный режим',
        description: 'Когда Safe Mode включен, система имитирует публикацию, но на самом деле ничего не отправляет. Идеально для тестов.',
        side: 'left',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ingestion')
    },

    {
      element: '[data-tutorial="settings-schedule"]',
      popover: {
        title: '⏰ Расписание сбора',
        description: 'Настройте интервал, с которым система будет обходить ваши источники (например, каждый час).',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ingestion')
    },

    {
      element: '[data-tutorial="settings-sources"]',
      popover: {
        title: '🌐 Ваши источники',
        description: 'Список всех сайтов и RSS-лент, которые мы мониторим. Вы можете добавлять свои или отключать ненужные.',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('ingestion')
    },

    {
      element: '[data-tutorial="settings-tab-integrations"]',
      popover: {
        title: '🔗 Соцсети и API',
        description: 'Подключение ваших Telegram-каналов, групп VK, OK и интеграция с Tilda.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('integrations')
    },

    {
      element: '[data-tutorial="settings-integrations"]',
      popover: {
        title: '🔌 Соцсети и API',
        description: 'Здесь настраивается связь с вашими Telegram-каналами, группами VK и сайтом на Tilda.',
        side: 'top',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('integrations')
    },

    {
      element: '[data-tutorial="settings-tab-prompts"]',
      popover: {
        title: '📝 Промпты',
        description: 'Редактор системных инструкций для ИИ. Здесь вы определяете стиль и логику обработки новостей.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('prompts')
    },

    {
      element: '[data-tutorial="settings-tab-logs"]',
      popover: {
        title: '📊 Логи ИИ',
        description: 'История всех "мыслей" и правок нейросети. Полезно для отладки, если AI начал вести себя странно.',
        side: 'bottom',
        align: 'center'
      },
      onHighlightStarted: () => onTabChange('logs')
    },

    {
      popover: {
        title: '🎉 Настройка завершена!',
        description: `
        <div class="space-y-4">
          <p class="text-base text-center">Не забывайте нажимать <strong>«Сохранить»</strong> в конце каждой вкладки при изменении настроек.</p>
        </div>
      `,
        side: 'bottom',
        align: 'center'
      }
    }
  ]
