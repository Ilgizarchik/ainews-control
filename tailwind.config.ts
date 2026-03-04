/**
 * Tailwind CSS v4 не использует этот файл.
 * Конфигурация вынесена в globals.css через @theme директиву.
 * Файл оставлен для совместимости с тулингом (IDE autocomplete).
 *
 * @type {import('tailwindcss').Config}
 */
const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
}

export default config
