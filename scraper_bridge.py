
import sys
import json
import argparse
from anti_detect import create_session, make_request
from bs4 import BeautifulSoup

def scrape(url, proxy=None):
    try:
        # 1. Создаем сессию с имитацией браузера через curl_cffi
        session, lib, imp = create_session(proxy=proxy, impersonate="chrome131")
        
        # 2. Делаем запрос
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
        
        response = make_request(session, "GET", url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return {"error": f"HTTP {response.status_code}", "content": ""}

        # 3. Базовая очистка контента через BeautifulSoup
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Удаляем мусор
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
            
        # Пытаемся найти основной текст
        main_content = ""
        # Популярные селекторы для статей
        article_tags = soup.find_all(['article', 'main', 'div'], class_=lambda x: x and ('content' in x or 'article' in x or 'post' in x))
        
        if article_tags:
            main_content = " ".join([t.get_text(separator=' ', strip=True) for t in article_tags])
        else:
            main_content = soup.get_text(separator=' ', strip=True)

        return {
            "success": True,
            "content": main_content[:20000], # Ограничиваем для безопасности
            "status": response.status_code
        }

    except Exception as e:
        return {"error": str(e), "content": ""}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--proxy", required=False)
    args = parser.parse_args()

    result = scrape(args.url, args.proxy)
    print(json.dumps(result, ensure_ascii=False))
