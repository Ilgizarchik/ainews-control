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
            // This rule is too strict for common "mounted" patterns in Next.js client components.
            'react-hooks/set-state-in-effect': 'off',

            // Avoids false positives for inline "skeleton" components used only for rendering.
            'react-hooks/static-components': 'off',

            // Keep as a warning (doesn't fail CI) since it's often acceptable in UI copy.
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
