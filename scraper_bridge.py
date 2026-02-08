
import io
import sys

# Принудительно UTF-8
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
import argparse
import os
import contextlib

# Подавляем ВООБЩЕ ВСЁ. Даже если кто-то пишет в дескрипторы 1 и 2 напрямую.
@contextlib.contextmanager
def suppress_all():
    # Создаем временный файл для stdout и stderr, чтобы они не лезли в основной stdout
    with open(os.devnull, "w", encoding="utf-8") as devnull:
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = devnull
        sys.stderr = devnull
        try:
            yield
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

# Импортируем зависимости максимально тихо
with suppress_all():
    try:
        from anti_detect import create_session, make_request
        from bs4 import BeautifulSoup
    except Exception:
        create_session = None

def scrape(url, proxy=None):
    if not create_session:
        return {"error": "Module anti_detect.py or dependencies not found", "content": ""}
        
    try:
        # Создаем сессию
        with suppress_all():
            session, lib, imp = create_session(proxy=proxy, impersonate="chrome131")
        
        headers = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9,ru;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
        }
        
        # Запрос
        with suppress_all():
            response = make_request(session, "GET", url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return {"error": f"HTTP {response.status_code}", "content": ""}

        # Парсинг
        soup = BeautifulSoup(response.text, 'lxml')
        
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
            
        main_content = ""
        article = soup.find('article')
        if article:
            # Убираем лишние пробелы и пустые строки
            main_content = article.get_text(separator='\n', strip=True)
        else:
            content_tags = soup.find_all(['main', 'div', 'section'], class_=lambda x: x and any(c in x.lower() for c in ['content', 'article', 'post', 'body', 'main']))
            if content_tags:
                best_tag = max(content_tags, key=lambda t: len(t.get_text()))
                main_content = best_tag.get_text(separator='\n', strip=True)
            else:
                main_content = soup.get_text(separator='\n', strip=True)

        return {
            "success": True,
            "content": main_content[:25000],
            "status": response.status_code
        }

    except Exception as e:
        return {"error": str(e), "content": ""}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--proxy", required=False)
    args = parser.parse_args()

    # Сначала собираем результат
    result = scrape(args.url, args.proxy)
    
    # И в самом конце выводим ТОЛЬКО финальный JSON. 
    # Никакие импорты или ошибки выше не должны сюда попасть.
    json_output = json.dumps(result, ensure_ascii=False)
    
    # Используем прямое системное обращение к stdout дескриптору, 
    # чтобы обойти возможные перехваты в Python
    sys.stdout.write(json_output)
    sys.stdout.flush()
    os._exit(0) # Жесткий выход, чтобы не допустить никаких принтов в фазе завершения скрипта
