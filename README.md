# AI Presentations

NestJS-сервис для AI-генерации презентаций в собственный JSON DSL с web-preview.
Цель текущей версии - минимальная, но прочная Gamma-like основа: пользователь
задает тему или материал, сервис строит outline, по одному генерирует слайды,
валидирует их, при необходимости чинит через repair-запрос и собирает финальный
`presentation JSON`.

## Главный принцип

PPTX не является внутренним форматом сервиса. Внутренний формат - собственная
JSON document model:

```text
presentation
  -> slides
    -> root_container
      -> layout containers
        -> elements
```

Слайд не хранит плоский список элементов. Каждый `slide` хранит
`root_container`, внутри которого находятся layout-контейнеры и элементы.

PPTX/PDF/HTML/PNG export, визуальное редактирование и полноценный asset pipeline
планируются как следующие слои поверх DSL, но не должны становиться источником
правды для структуры презентации.

## Основные директории

```text
src/presentation-generation/
  schemas/                 Zod-схемы внутреннего DSL и LLM wrappers
  templates/               MVP templates, source of truth для layout recipes
  validation/              Централизованные DSL/template validators
  generation/              Registry, JSON Schema generation, id normalizer
  __tests__/               Contract tests без LLM-вызовов
  presentation-generation.service.ts
  presentation-generation.prompts.ts
  presentation-preview.service.ts
```

`schemas/` и `templates/` являются source of truth. Новые фундаментальные
сущности DSL нельзя добавлять случайно: сначала нужно понять, что они не
выражаются через уже существующую модель.

## DSL: presentation, slide, containers, elements

Актуальные DSL-сущности на этом этапе:

- `presentation`
- `slide`
- layout containers: `stack`, `row`, `grid`
- elements: `title`, `subtitle`, `text`, `bullets`, `image`, `cards`, `table`,
  `chart`

`section` сейчас не является DSL-сущностью в коде. Логические разделы
презентации выражаются через outline, slide titles/intents и порядок слайдов.

Корневой объект:

```ts
presentation {
  id: string;
  type: "presentation";
  title?: string;
  slides: Slide[];
}
```

Слайд:

```ts
slide {
  id: string;
  type: "slide";
  root_container: LayoutContainer;
  source_reference?: string;
}
```

Поддерживаемые layout containers:

- `stack`
- `row`
- `grid`

`column` не является отдельной сущностью. Колонка - это child-узел внутри `row`
с параметром `width`.

Общие параметры containers:

- `id` optional
- `type`
- `children`
- `slot`
- `accepts`
- `required`
- `gap`
- `padding`
- `align`
- `justify`
- `width`
- `columns` только для `grid`, значение `number | "auto"`

Layout-контейнеры не являются визуальными элементами. Они задают структуру
расположения и правила заполнения.

### Layout container reference

`stack` - вертикальный контейнер. Дочерние элементы идут сверху вниз:

```json
{
  "type": "stack",
  "gap": 18,
  "children": []
}
```

`row` - горизонтальный контейнер. Колонки выражаются через дочерние containers
с `width`:

```json
{
  "type": "row",
  "gap": 24,
  "children": [
    { "type": "stack", "width": 0.6, "children": [] },
    { "type": "stack", "width": 0.4, "children": [] }
  ]
}
```

Если у children внутри `row` задан `width`, сумма widths должна быть примерно
`1`.

`grid` - сеточный контейнер:

```json
{
  "type": "grid",
  "columns": "auto",
  "gap": 16,
  "children": []
}
```

`columns` может быть числом или `"auto"`. Значение `"auto"` сейчас рендерится
как responsive auto-fit grid.

### Slots

`slot` - смысловая роль layout-узла внутри template. Slot не задает координаты,
размеры или стиль напрямую. Он связывает часть template tree с назначением:

- `title`
- `body`
- `visual`
- `data`
- `comment`
- `footer`

Пример fillable slot:

```json
{
  "type": "stack",
  "slot": "body",
  "accepts": ["text", "bullets", "cards"],
  "required": true,
  "children": []
}
```

`accepts` задает полный список element types, которые можно положить в этот
slot. `required: true` означает, что slot должен содержать хотя бы один accepted
descendant element.

Поддерживаемые MVP elements:

- `title`
- `subtitle`
- `text`
- `bullets`
- `image`
- `cards`
- `table`
- `chart`

Общие параметры elements:

- `id` - обязательный технический id элемента. LLM возвращает его формально, но
  финальные ids перезаписываются backend normalizer-ом.
- `type` - тип элемента.
- `style` - optional строка. Сейчас разрешена схемой, но renderer ее не
  использует как полноценный styling API.
- `source_reference` - optional ссылка на источник информации.

### Element reference

`title`, `subtitle`, `text` имеют одинаковую content-форму:

```json
{
  "id": "el_1_1",
  "type": "title",
  "text": "Главный заголовок"
}
```

`bullets`:

```json
{
  "id": "el_1_2",
  "type": "bullets",
  "items": ["Первый тезис", "Второй тезис", "Третий тезис"]
}
```

`image`:

```json
{
  "id": "el_1_3",
  "type": "image",
  "asset_id": "placeholder://image-1",
  "alt": "Описание изображения",
  "fit": "cover"
}
```

`fit` optional и может быть `cover`, `contain` или `fill`. На текущем MVP
`asset_id` является placeholder / future asset reference, а не полноценным
asset pipeline.

`cards`:

```json
{
  "id": "el_1_4",
  "type": "cards",
  "items": [
    { "title": "Быстро", "text": "Генерация за пару минут" },
    { "title": "Редактируемо", "text": "Можно править структуру" }
  ]
}
```

`table`:

```json
{
  "id": "el_1_5",
  "type": "table",
  "columns": ["Критерий", "Gamma", "Наш сервис"],
  "rows": [
    ["Доступность", "Ограничена", "Локально доступен"],
    ["Кастомные templates", "Ограничены", "Есть"]
  ]
}
```

`chart` поддерживает `bar`, `line`, `pie`.

Bar chart:

```json
{
  "id": "el_1_6",
  "type": "chart",
  "chart_type": "bar",
  "labels": ["Скорость", "Вес", "Выносливость"],
  "series": [
    { "label": "Игрок A", "values": [80, 70, 90] },
    { "label": "Игрок B", "values": [65, 85, 75] }
  ],
  "unit": "баллы"
}
```

Line chart:

```json
{
  "id": "el_1_7",
  "type": "chart",
  "chart_type": "line",
  "labels": ["Январь", "Февраль", "Март"],
  "series": [
    { "label": "Token A", "values": [100, 140, 180] },
    { "label": "Token B", "values": [90, 120, 160] }
  ],
  "unit": "$"
}
```

Pie chart:

```json
{
  "id": "el_1_8",
  "type": "chart",
  "chart_type": "pie",
  "slices": [
    { "label": "Студенты", "value": 65 },
    { "label": "Преподаватели", "value": 20 },
    { "label": "Бизнес", "value": 15 }
  ],
  "unit": "%"
}
```

Базовая table/chart семантика уже находится в Zod:

- `table.rows[*].length` должен совпадать с `table.columns.length`;
- для `bar` и `line` chart длина `series[*].values` должна совпадать с
  `labels.length`;
- chart/table arrays не должны быть пустыми.

Расширенная смысловая проверка графиков и таблиц пока не делается. Для MVP
модель может использовать правдоподобные иллюстративные данные, если пользователь
не дал точные цифры. При этом не нужно выдумывать источники или псевдоточную
статистику.

## Templates

Templates - это не PowerPoint-шаблоны и не финальный дизайн. Это динамические
рецепты сборки слайда из layout containers и elements.

MVP templates лежат в `src/presentation-generation/templates/`:

- `cover`
- `content`
- `split_content`
- `data_focus`
- `grid_content`

Template описывает:

- `id`
- `intent`
- `layout_container_tree`
- `limits`
- `fallbacks`
- `dynamic_rules`
- `style_hints`

Отдельных `zones`, `required_elements`, `optional_elements`,
`allowed_elements` нет. Все выражается внутри layout-узлов через:

- `slot`
- `accepts`
- `required`

`layout_container_tree` является структурной базой слайда. LLM выбирает
`template_id`, но backend проверяет, что возвращенный `slide.root_container`
действительно соответствует выбранному template.

`fallbacks`, `dynamic_rules` и `style_hints` сейчас являются template metadata:
они валидируются схемой, передаются модели в prompt и помогают ей принять
решение, но backend пока не исполняет их как отдельную runtime-логику.

Пример template layout node:

```json
{
  "type": "stack",
  "slot": "title",
  "accepts": ["title", "subtitle"],
  "required": true,
  "children": []
}
```

Пример `row` с двумя колонками:

```json
{
  "type": "row",
  "gap": 24,
  "children": [
    {
      "type": "stack",
      "slot": "body",
      "width": 0.5,
      "accepts": ["text", "bullets", "cards"],
      "required": true,
      "children": []
    },
    {
      "type": "stack",
      "slot": "visual",
      "width": 0.5,
      "accepts": ["image", "chart", "table"],
      "required": false,
      "children": []
    }
  ]
}
```

## Generation pipeline

Основной flow реализован в `PresentationGenerationService`.

### 1. User request -> outline

Пользователь передает prompt, например:

```text
Хочу презентацию на тему "Геостратегия", 5 слайдов
```

LLM возвращает логический outline:

```ts
{
  title?: string;
  slides: Array<{
    index: number;
    title: string;
    intent?: string;
  }>;
}
```

На этом шаге DSL слайдов еще не генерируется.

### 2. Outline -> per-slide generation

Каждый слайд генерируется отдельным LLM-вызовом. На вход модели передается:

- полный outline презентации;
- outline текущего слайда;
- список доступных templates;
- список доступных elements;
- уже сгенерированные предыдущие слайды.

Предыдущие слайды сейчас передаются как есть, без compression/summary. Это
осознанное MVP-решение: модель видит реальную структуру уже созданных слайдов и
лучше поддерживает общий стиль/уровень детализации.

LLM в одном ответе должна:

- выбрать подходящий `template_id`;
- использовать `template.layout_container_tree` как структурную основу;
- выбрать slots для заполнения;
- выбрать elements;
- сгенерировать финальный контент elements.

Ответ per-slide generation всегда является wrapper-объектом:

```ts
{
  template_id: string;
  slide: Slide;
}
```

`template_id` не попадает в финальный `presentation.slides[]`, но до этого он
важен для validation, repair, template limits и debug. По нему backend выбирает
template и проверяет, что LLM действительно использовала выбранную структуру.

Пример ответа LLM:

```json
{
  "template_id": "grid_content",
  "slide": {
    "id": "llm_slide_3",
    "type": "slide",
    "root_container": {
      "type": "stack",
      "gap": 18,
      "children": [
        {
          "type": "stack",
          "slot": "title",
          "accepts": ["title", "subtitle"],
          "required": true,
          "children": [
            {
              "id": "llm_el_title",
              "type": "title",
              "text": "Инструменты геостратегического влияния"
            }
          ]
        },
        {
          "type": "grid",
          "slot": "body",
          "columns": "auto",
          "gap": 16,
          "accepts": ["cards", "image"],
          "required": true,
          "children": [
            {
              "id": "llm_el_cards",
              "type": "cards",
              "items": [
                {
                  "title": "Военная сила",
                  "text": "Базы, союзы, контроль территорий и зон безопасности."
                },
                {
                  "title": "Экономика",
                  "text": "Санкции, инвестиции, рынки и контроль ресурсов."
                },
                {
                  "title": "Технологии",
                  "text": "ИИ, кибербезопасность, полупроводники и критическая инфраструктура."
                },
                {
                  "title": "Информация",
                  "text": "Медиа, нарративы и влияние на общественное мнение."
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

`id` в LLM-ответе не являются финальными. После успешной hard validation backend
перезапишет их в `slide_3`, `el_3_1`, `el_3_2` и так далее.

### 3. Hard validation

После ответа LLM сервис валидирует wrapper через:

```ts
validatePerSlideGenerationResult(input, templatesOrRegistry)
```

Эта проверка делает три вещи:

1. Zod проверяет форму `{ template_id, slide }`.
2. `template_id` должен существовать в registry.
3. `slide` проверяется против выбранного template через
   `validateSlideAgainstTemplate`.

Hard validation ошибки блокируют слайд и запускают repair.

Template limits не входят в hard validation. Они проверяются позже как soft
issues: презентация возвращается, но получает `status: "partial_success"`.

### 4. Repair

Если hard validation падает, сервис делает repair-запрос в LLM. В repair
передается:

- полный outline;
- текущий outline slide;
- список templates/elements;
- выбранный template, если его удалось определить;
- предыдущие валидные слайды;
- исходный raw response;
- validation errors.

Repair возвращает тот же wrapper:

```ts
{
  template_id: string;
  slide: Slide;
}
```

Repair должен чинить только невалидные части, не менять смысл слайда без
необходимости и не менять `template_id`, если он валиден.

Количество попыток задается через:

```env
PRESENTATION_GENERATION_MAX_ATTEMPTS=2
```

Этот параметр используется и для outline retry, и для per-slide generation.

При значении `2` это означает:

```text
outline: до 2 попыток
per-slide: 1 generate attempt + 1 repair attempt
```

Если после всех попыток hard validation все еще падает, сервис возвращает `422`.
Graceful fallback для hard-invalid slide пока не реализован.

### 5. Backend-owned ids

LLM пока возвращает `id`, потому что схемы требуют `slide.id` и `element.id`.
Но финальные технические идентификаторы принадлежат backend.

После успешной hard validation или repair сервис вызывает:

```ts
normalizeSlideIds(slide, slideIndex)
```

Normalizer перезаписывает:

```text
slide.id -> slide_1
element.id -> el_1_1, el_1_2, el_1_3
container.id -> container_1_1, container_1_2, если id уже был
```

Container ids optional. Если у container нет `id`, normalizer его не добавляет.

Duplicate ids от LLM не считаются ошибкой и не отправляются в repair. Backend
просто последовательно проходит дерево и проставляет стабильные id.

### 6. Soft template limits

После нормализации ids сервис проверяет count-like limits выбранного template:

- `bullets_max_items`
- `cards_min_items`
- `cards_max_items`
- `table_max_rows`
- `chart_max_series`
- `images_min_items`
- `images_max_items`

`images_min_items` применяется только если в слайде уже есть хотя бы один
`image`. Это не заставляет модель добавлять изображение в slot, который она
решила не заполнять изображением.

Нарушение этих limits не блокирует презентацию. Вместо этого результат получает:

```ts
status: "partial_success";
issues: GenerationIssue[];
```

Это сделано специально: в MVP лучше увидеть презентацию, даже если один слайд
немного перегружен, чем полностью терять результат.

Line limits не проверяются:

- `title_max_lines`
- `subtitle_max_lines`
- `text_max_lines`

Причина: количество строк зависит от renderer width, шрифта, языка и будущего
дизайна. Пока это не является жесткой validation rule.

### 7. Final presentation validation

Когда все слайды готовы, backend собирает:

```ts
{
  id: "presentation_1",
  type: "presentation",
  title: outline.title,
  slides: previousSlides
}
```

После этого весь объект проверяется через `PresentationSchema`.

Эта проверка гарантирует структурную валидность всей презентации:

- есть `presentation`;
- есть непустой `slides`;
- каждый slide валиден;
- containers/elements рекурсивно валидны;
- table/chart shape не сломан;
- лишние поля отклоняются через `.strict()`.

Отдельная runtime-проверка уникальности ids сейчас не нужна, потому что ids
полностью перезаписываются backend normalizer-ом.

## Validation layers

В проекте есть несколько разных уровней проверки. Их важно не смешивать.

### Zod schema validation

Проверяет форму данных:

- допустимые `type`;
- обязательные поля;
- отсутствие лишних полей через `.strict()`;
- рекурсивную структуру `root_container`;
- базовую table/chart совместимость.

Zod не знает, насколько честно LLM использовала выбранный template.

### Template/rules validation

Проверяет соответствие слайда выбранному template:

- `template_id` существует;
- `root_container` соответствует `layout_container_tree`;
- required slots заполнены;
- elements входят в `accepts`;
- nested containers внутри fillable slot не объявляют свои `slot`, `accepts`,
  `required`.

Эти ошибки считаются hard validation errors и запускают repair.

### Soft template limits

Проверяют count-like limits. Эти ошибки не запускают repair и не валят
генерацию. Они попадают в `issues` ответа и переводят результат в
`partial_success`.

### Renderer smoke

Проверяет не качество верстки, а базовую renderability: валидный DSL с каждым
MVP element type должен отрендериться в HTML без exception.

## Template matching rules

`validateSlideAgainstTemplate(slide, template)` - центральная проверка, что LLM
не просто вернула валидный JSON, а действительно использовала выбранный template.

Правила:

- template tree каноничен до fillable slot;
- fillable slot - это template node с `accepts`;
- structural nodes должны сохранять ключевые поля template:
  - `type`
  - `slot`
  - `accepts`
  - `required`
  - `gap`
  - `padding`
  - `align`
  - `justify`
  - `width`
  - `columns`
- structural children до fillable slot сравниваются по порядку и количеству;
- если template node имеет `accepts`, его subtree считается fillable area;
- внутри fillable slot разрешены nested `stack`/`row`/`grid` containers для
  локальной компоновки;
- nested containers внутри fillable slot не могут объявлять собственные
  `slot`, `accepts`, `required`;
- каждый descendant element внутри fillable slot должен входить в parent
  `accepts`;
- `required: true` означает, что slot должен содержать хотя бы один accepted
  descendant element.

Это важнее простой Zod-проверки: Zod валидирует форму данных, а template
validator проверяет соблюдение проектных DSL-правил.

## JSON Schema and structured output

Zod v4 является source of truth для LLM response contracts.

Активные JSON Schema для OpenRouter генерируются из Zod через:

```ts
z.toJSONSchema(...)
```

Активные response schemas:

- `OutlineGenerationResponseJsonSchema`
- `PerSlideGenerationResponseJsonSchema`

Manual JSON Schema оставлены только для сравнения и debug-логов:

- `ManualOutlineGenerationResponseJsonSchema`
- `ManualPerSlideGenerationResponseJsonSchema`

Сейчас `strict: false` используется осознанно. Это безопасная MVP-стратегия для
OpenRouter/моделей до живых экспериментов со strict mode. Структурная строгость
все равно обеспечивается Zod + validators после ответа модели.

## Template selection policy

Template выбирает LLM. Backend не пытается оценивать, насколько эстетически
идеально выбран template.

Текущая политика:

- модель видит все templates, их `intent`, slots, accepts, limits;
- модель выбирает `template_id`;
- backend проверяет, что `template_id` существует;
- backend проверяет, что slide действительно соответствует выбранному template;
- repair сохраняет `template_id`, если он валиден;
- repair может выбрать другой template только если исходный `template_id`
  отсутствует или неизвестен.

На MVP этого достаточно. Ручной scoring templates или жесткая мапа
`intent -> template` пока не нужны.

## Images and assets

На текущем этапе `image.asset_id` - это placeholder / ссылка на будущий asset.
Пользователь сможет заменить изображения в готовой презентации.

Правило для LLM:

- если используется `image`, нужно заполнить `asset_id`;
- `asset_id` должен быть стабильным placeholder id;
- `alt` обязателен.

Полноценный image asset pipeline пока не реализован.

## Renderer

`PresentationPreviewService` получает валидный `presentation JSON` и рендерит
HTML preview.

Поддерживаются:

- containers: `stack`, `row`, `grid`;
- elements: `title`, `subtitle`, `text`, `bullets`, `image`, `cards`, `table`,
  `chart`.

Renderer сейчас простой и детерминированный. Он нужен для визуальной проверки
DSL и базового web-preview. Автоматическая pixel/layout validation не делается.

Есть renderer smoke contract test: валидная презентация со всеми MVP elements
должна отрендериться без exception и содержать ожидаемые HTML-блоки.

## API

Base controller:

```text
/presentation-generation
```

### POST /presentation-generation/test

Генерирует презентацию и возвращает полный JSON/debug result:

```json
{
  "prompt": "Хочу презентацию на тему Геостратегия, 5 слайдов"
}
```

Ответ содержит:

- `status`: `success` или `partial_success`;
- `issues`: non-blocking issues, сейчас это template limits;
- `outline`;
- `slides`: debug-массив `{ template_id, slide }`;
- `presentation`: финальный валидный presentation JSON;
- `debug.trace_id`;
- `debug.attempts`.

### POST /presentation-generation/preview

Генерирует презентацию и возвращает HTML preview.

### POST /presentation-generation/html

Принимает уже готовый `presentation JSON` или `{ presentation }` wrapper и
рендерит HTML preview без LLM-вызова.

## Environment

Пример находится в `.env.example`.

Обязательные параметры:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

Основные параметры:

```env
PORT=3000
LOG_LEVELS=log,warn,error,debug,verbose

OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0.35
OPENROUTER_MAX_TOKENS=6000
OPENROUTER_REQUIRE_PARAMETERS=true
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=AI Presentations

PRESENTATION_GENERATION_MAX_ATTEMPTS=2
```

`OPENROUTER_API_KEY` обязателен: это ядро приложения, fallback без LLM не
предусмотрен.

## Commands

```bash
npm install
npm run start:dev
npm run typecheck
npm run test:contracts
npm run build
```

`test:contracts` не вызывает LLM и не ходит в OpenRouter. Это защитный контур
для схем, validators, JSON Schema contracts, id normalizer и renderer smoke.

Сейчас contract suite покрывает:

- Zod presentation contracts;
- запрет flat `elements` на slide;
- table/chart базовую семантику;
- `validateSlideAgainstTemplate`;
- required slots;
- `accepts`;
- nested containers внутри fillable slots;
- template item limits;
- отсутствие validation для line limits;
- wrapper `{ template_id, slide }`;
- generated Zod-backed JSON Schema;
- backend id normalization;
- renderer smoke.

## Current MVP decisions and limits

То, что сделано осознанно и пока не считается проблемой:

- previous generated slides передаются в LLM как есть, без compression;
- модель может создавать иллюстративные chart/table данные, если пользователь не
  дал точные цифры;
- line limits не валидируются;
- soft template limits не блокируют генерацию;
- strict JSON Schema mode пока выключен;
- hard-invalid slide после всех repair attempts возвращает `422`;
- dynamic rules вроде `auto_by_items_count` пока не имеют отдельного runtime
  обработчика;
- image assets пока placeholder-based;
- prompt/version snapshots пока не ведутся;
- PPTX/PDF/PNG/HTML export как отдельные артефакты пока не реализован.

Главный критерий текущего фундамента: валидный `presentation JSON` должен быть
стабильным внутренним форматом, пригодным для preview, будущего экспорта и
дальнейшего редактирования.
