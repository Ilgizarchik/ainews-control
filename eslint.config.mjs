import next from 'eslint-config-next'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from '@typescript-eslint/eslint-plugin'

const config = [
    ...next,
    {
        files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
        plugins: {
            react,
            'react-hooks': reactHooks
        },
        rules: {
            // Это правило слишком строго для типичных паттернов "mounted" в клиентских компонентах Next.js.
            'react-hooks/set-state-in-effect': 'off',

            // Избегаем ложных срабатываний для встроенных "skeleton"-компонентов, используемых только для рендера.
            'react-hooks/static-components': 'off',

            // Оставляем предупреждение (не валит CI), так как это часто допустимо в UI-текстах.
            'react/no-unescaped-entities': 'warn'
        }
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tseslint
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ]
        }
    }
]

export default config
