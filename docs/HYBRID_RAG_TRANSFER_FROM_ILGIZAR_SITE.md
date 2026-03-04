# Перенос гибридной RAG-памяти и агентного контура из `ilgizar.site` в `ainews-control-center`

## 1. Что сравнивалось

Сравнение выполнено между:

- Источник: `C:\Users\Admin\Desktop\Site\Studio-Monorepo\apps\ilgizar.site`
- Цель: `C:\Users\Admin\Desktop\news\ainews-control-center.fresh`

Ключевые файлы источника:

- `src/lib/rag/hybrid/search.ts`
- `src/lib/rag/hybrid/score.ts`
- `src/lib/rag/hybrid/metadata-filter.ts`
- `src/app/api/ai-chat/route.ts`
- `src/app/api/ai-chat/lib/agent-execution/local-agent.ts`
- `src/app/api/ai-chat/lib/persistence.ts`
- `src/app/api/ai-chat/lib/persistence/lead-handoff.ts`
- `src/app/api/knowledge/lib/upload-handler.ts`
- `src/lib/db/schema.ts`

Ключевые файлы текущего проекта:

- `lib/ai-service.ts`
- `lib/generation-service.ts`
- `app/api/ai/generate-field/route.ts`
- `app/api/ai/generate-news-draft/route.ts`
- `app/api/ai/generate-review/route.ts`
- `types/database.types.ts`
- `docs/ARCHITECTURE.md`

## 2. Короткий вывод

В `ilgizar.site` реализован полноценный агентный runtime с памятью, hybrid RAG, лид-конвейером и QoS.

В текущем `ainews-control-center` агентного контура нет: есть только генерация контента по промптам для `news/review`, без:

- векторной базы знаний,
- сессионной памяти диалога,
- оценки релевантности RAG,
- state-machine лида/handoff,
- telemetry/eval-событий по диалогу.

Перенос возможен и целесообразен, но не «копипастой»: источник построен на Drizzle + dynamic DB, а текущий проект на Supabase client + `project_settings`.

## 3. Что переносится почти напрямую

## 3.1 Алгоритм hybrid retrieval + rerank

Переносимые идеи из `src/lib/rag/hybrid/*`:

- Двойной поиск: `vector + keyword`.
- Fallback keyword-поиска: `tsquery -> ILIKE`.
- Слияние кандидатов по `chunk_id`.
- RRF-реранк + overlap + freshness + priority.
- Метаданные-фильтры: `locale`, `niche`, `is_active`, `max_age_days`.

Это можно перенести почти 1:1 как отдельный модуль, поменяв слой доступа к БД.

## 3.2 Политика low-relevance для RAG

Из `prompting.ts` переносится почти без изменений:

- пороги `min_final_score`, `min_vector_score`, `min_keyword_score`, `min_overlap_score`,
- required signals,
- ветка безопасного ответа при низкой релевантности (без выдумывания фактов).

## 3.3 Prompt versioning + A/B bucket

Из `prompting.ts` переносится:

- стабильный bucket по `session_id`,
- версии prompt A/B,
- фиксация версии для всей сессии.

## 3.4 QoS слой

Из `qos-runtime.ts` и `agent-execution/qos-runner.ts` переносится:

- timeout,
- retry with backoff,
- circuit breaker,
- controlled error response.

## 3.5 Ingestion pipeline базы знаний

Из `api/knowledge` переносится:

- загрузка документа,
- chunking с overlap,
- генерация embedding,
- сохранение metadata,
- обновление чанка с реэмбеддингом при изменении контента.

## 4. Что нужно адаптировать под этот проект

## 4.1 Слой БД (критично)

В источнике поиск выполнен SQL через Drizzle (`db.execute(...)`), а в текущем проекте используется Supabase API.

Рекомендация:

- сложный vector/fts SQL вынести в Postgres functions (`rpc`) в Supabase;
- из Next.js вызывать эти функции через `supabase.rpc(...)`;
- embedding хранить в `vector(1536)` в Supabase Postgres.

## 4.2 Схема таблиц

В текущем `types/database.types.ts` нет таблиц для knowledge/chat memory.

Нужно добавить миграциями:

- `knowledge_docs`
- `knowledge_chunks` (`embedding vector(1536)`, `metadata jsonb`)
- `chat_messages`
- `chat_leads`
- `chat_lead_events`
- `chat_eval_events`
- `chat_handoffs`

Рекомендация: оставить префикс `admin_` или ввести единый `ai_` префикс, но единообразно по всем таблицам.

## 4.3 Конфигурация через `project_settings`

В текущем проекте уже есть `project_settings` как главный storage конфигов.

Нужно добавить ключи:

- `rag_final_chunks`
- `rag_vector_top_k`
- `rag_keyword_top_k`
- `rag_min_vector_similarity`
- `rag_filter_locale`
- `rag_filter_niche`
- `rag_filter_only_active`
- `rag_filter_max_age_days`
- `rag_low_relevance_min_final_score`
- `rag_low_relevance_min_vector_score`
- `rag_low_relevance_min_keyword_score`
- `rag_low_relevance_min_overlap_score`
- `rag_low_relevance_required_signals`
- `chat_history_depth`
- `prompt_ab_enabled`
- `prompt_ab_version_a`
- `prompt_ab_version_b`
- `prompt_ab_system_prompt_a`
- `prompt_ab_system_prompt_b`
- `prompt_ab_weight_a`
- `qos_local_timeout_ms`
- `qos_local_retry_count`
- `qos_local_retry_backoff_ms`
- `qos_cb_failure_threshold`
- `qos_cb_open_ms`
- `qos_controlled_error_message`

## 4.4 API-контур

В текущем проекте нет `/api/ai-chat`.

Нужно добавить:

- `POST /api/ai-chat` (stream + legacy payload при необходимости),
- `GET /api/ai-chat/history?sessionId=...`,
- `POST /api/knowledge` и дочерние endpoints для админки знаний.

## 4.5 UI в Settings

Текущая страница `app/(dashboard)/settings/page.tsx` уже сохраняет настройки.

Нужно добавить отдельный раздел в Settings:

- параметры RAG,
- переключатели low-relevance policy,
- параметры QoS,
- A/B prompt controls,
- загрузка и редактирование knowledge chunks.

## 5. Что НЕ стоит переносить как есть

- Dynamic DB routing из `ilgizar.site` (`getDynamicDb`) не нужен, текущий проект single-tenant.
- Legacy дублирующий контур чата не нужен; лучше сразу один endpoint.
- Лишние сущности из source (кампании email и пр.) не относятся к задаче RAG-памяти.

## 6. Приоритетный план внедрения

## Этап P0 (самый быстрый практический эффект)

1. Добавить таблицы knowledge + chat memory + events.
2. Добавить ingestion endpoint текст/PDF -> chunks -> embeddings.
3. Реализовать `searchHybridKnowledge` через Supabase RPC.
4. Подключить retrieval к одному новому endpoint `/api/ai-chat`.
5. Добавить low-relevance fallback.

Результат P0:

- появится рабочая гибридная память,
- снизится hallucination,
- появится базовая история диалога.

## Этап P1 (управляемость и качество)

1. Lead state-machine (`discovery -> proposal -> contact_requested -> contact_captured -> handoff`).
2. Dedupe/идемпотентная запись лидов.
3. Handoff карточки + уведомления в Telegram/Notification center.
4. Eval events и метрики конверсии.
5. Prompt A/B и закрепление версии за сессией.

## Этап P2 (надежность и эксплуатация)

1. QoS retry/circuit breaker.
2. Отчеты по качеству (`lead_capture_rate`, `avg_turns_to_contact`, `false_lead_rate`).
3. Очереди для тяжелых post-processing задач.
4. Retention/masking для PII в логах.

## 7. Технические риски и как закрыть

Риск: тяжелые SQL-запросы для vector+fts в Supabase.

Решение:

- вынести логику в SQL-функции,
- добавить индексы: HNSW/IVFFlat для embedding, GIN для `to_tsvector`.

Риск: рост стоимости/объема хранения.

Решение:

- ограничить `finalTopK` и `vectorTopK`,
- хранить компактные чанки (примерно 600-900 символов + overlap),
- регулярно архивировать/деактивировать старые chunks по metadata.

Риск: деградация UX при таймаутах модели.

Решение:

- timeout/retry/circuit breaker,
- controlled fallback reply без падения UI.

## 8. Что переносить в первую очередь именно для `ainews-control-center`

1. Hybrid retrieval + low-relevance policy.
2. Ingestion/knowledge admin API.
3. Session chat memory (`chat_messages`).
4. Prompt versioning + A/B.
5. Handoff и eval events.

Именно этот порядок даст максимальный эффект по качеству ответов и управляемости, без ломки текущего пайплайна генерации новостей.

## 9. Итог

Да, из `ilgizar.site` можно перенести большую часть гибридной RAG-памяти и агентной логики.

Оптимальный путь:

- переносить алгоритмы и контракты поведения,
- адаптировать data access слой под Supabase RPC,
- внедрять поэтапно (P0 -> P1 -> P2), начиная с retrieval + memory.
