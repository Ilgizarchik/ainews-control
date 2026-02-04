
-- 1. HuntPortal RSS
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('HuntPortal RSS', 'https://huntportal.ru/rss.xml', 'rss', true, '{}'::jsonb);

-- 2. RHM Magazine RSS
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('RHM Magazine RSS', 'https://rhm-magazine.ru/magazine/rss.php', 'rss', true, '{}'::jsonb);

-- 3. Hunting.ru (Legacy Parser)
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('Hunting.ru', 'https://www.hunting.ru/news/', 'html', true, '{"legacy_parser": "hunting-ru-news"}'::jsonb);

-- 4. Mooir News (Legacy Parser)
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('Mooir News', 'https://mooir.ru/official/world-news/', 'html', true, '{"legacy_parser": "mooir-ru-news"}'::jsonb);

-- 5. Mooir Orders (Legacy Parser)
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('Mooir Orders', 'https://mooir.ru/official/prikras/', 'html', true, '{"legacy_parser": "mooir-ru-prikras"}'::jsonb);

-- 6. Ohotniki Laws (Legacy Parser)
INSERT INTO public.ingestion_sources (name, url, type, is_active, selectors)
VALUES 
('Ohotniki Laws', 'https://www.ohotniki.ru/search/?q=%D0%B7%D0%B0%D0%BA%D0%BE%D0%BD%D1%8B%20%D0%BE%D0%B1%20%D0%BE%D1%85%D0%BE%D1%82%D0%B5', 'html', true, '{"legacy_parser": "ohotniki-ru-search"}'::jsonb);
