import { Injectable, Logger } from "@nestjs/common";
import type { Element } from "./schemas/element-schema";
import type { LayoutChild, LayoutContainer } from "./schemas/container-schema";
import type { Presentation } from "./schemas/presentation-schema";

@Injectable()
export class PresentationPreviewService {
  private readonly logger = new Logger(PresentationPreviewService.name);

  renderHtml(presentation: Presentation): string {
    const startedAt = Date.now();
    const html = [
      "<!doctype html>",
      '<html lang="ru">',
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${escapeHtml(presentation.title ?? "Presentation preview")}</title>`,
      `<style>${PREVIEW_CSS}</style>`,
      "</head>",
      "<body>",
      `<main class="deck">${presentation.slides
        .map(
          (slide, index) =>
            `<section class="slide" data-slide="${index + 1}">${this.renderContainer(
              slide.root_container,
            )}</section>`,
        )
        .join("")}</main>`,
      "</body>",
      "</html>",
    ].join("");

    this.logger.log(
      `Preview rendered presentationId=${presentation.id} slides=${presentation.slides.length} htmlChars=${html.length} durationMs=${Date.now() - startedAt}`,
    );

    return html;
  }

  private renderChild(child: LayoutChild): string {
    if (isElement(child)) {
      return this.renderElement(child);
    }

    return this.renderContainer(child);
  }

  private renderContainer(container: LayoutContainer): string {
    const style = [
      container.gap !== undefined ? `--gap:${container.gap}px` : "",
      container.padding !== undefined ? `--padding:${container.padding}px` : "",
      container.width !== undefined ? `--width:${container.width}` : "",
      container.align !== undefined ? `--align:${toCssAlign(container.align)}` : "",
      container.justify !== undefined
        ? `--justify:${toCssJustify(container.justify)}`
        : "",
      container.type === "grid"
        ? `--columns:${container.columns === "auto" ? "auto-fit" : container.columns}`
        : "",
    ]
      .filter(Boolean)
      .join(";");

    return `<div class="container container-${container.type}" style="${style}">${container.children
      .map((child: LayoutChild) => this.renderChild(child))
      .join("")}</div>`;
  }

  private renderElement(element: Element): string {
    switch (element.type) {
      case "title":
        return `<h1>${escapeHtml(element.text)}</h1>`;
      case "subtitle":
        return `<h2>${escapeHtml(element.text)}</h2>`;
      case "text":
        return `<p>${escapeHtml(element.text)}</p>`;
      case "bullets":
        return `<ul>${element.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`;
      case "cards":
        return `<div class="cards">${element.items
          .map(
            (item) =>
              `<article class="card"><h3>${escapeHtml(
                item.title,
              )}</h3><p>${escapeHtml(item.text)}</p></article>`,
          )
          .join("")}</div>`;
      case "image":
        return `<figure class="image-placeholder"><div>${escapeHtml(
          element.alt,
        )}</div><figcaption>${escapeHtml(element.asset_id)}</figcaption></figure>`;
      case "table":
        return `<table><thead><tr>${element.columns
          .map((column) => `<th>${escapeHtml(column)}</th>`)
          .join("")}</tr></thead><tbody>${element.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
      case "chart":
        return `<div class="chart">${renderChart(element)}</div>`;
    }
  }
}

function isElement(child: LayoutChild): child is Element {
  return "id" in child && isElementType(child.type);
}

function isElementType(type: string): boolean {
  return [
    "title",
    "subtitle",
    "text",
    "bullets",
    "image",
    "cards",
    "table",
    "chart",
  ].includes(type);
}

function renderChart(element: Extract<Element, { type: "chart" }>): string {
  if (element.chart_type === "pie") {
    return `<strong>Pie chart</strong>${element.slices
      .map(
        (slice) =>
          `<div class="chart-row"><span>${escapeHtml(
            slice.label,
          )}</span><b>${slice.value}${escapeHtml(element.unit ?? "")}</b></div>`,
      )
      .join("")}`;
  }

  return `<strong>${element.chart_type} chart</strong>${element.series
    .map(
      (series) =>
        `<div class="chart-series"><em>${escapeHtml(series.label)}</em>${series.values
          .map((value, index) => {
            const label = element.labels[index] ?? "";
            return `<div class="chart-row"><span>${escapeHtml(
              label,
            )}</span><b>${value}${escapeHtml(element.unit ?? "")}</b></div>`;
          })
          .join("")}</div>`,
    )
    .join("")}`;
}

function toCssAlign(value: string): string {
  return value === "start" || value === "end" ? `flex-${value}` : value;
}

function toCssJustify(value: string): string {
  if (value === "space_between") {
    return "space-between";
  }

  return value === "start" || value === "end" ? `flex-${value}` : value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PREVIEW_CSS = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4f5f7;
  color: #171a1f;
}
* { box-sizing: border-box; }
body { margin: 0; }
.deck {
  display: grid;
  gap: 28px;
  padding: 32px;
}
.slide {
  width: min(1120px, calc(100vw - 64px));
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  padding: 56px;
  background: #ffffff;
  border: 1px solid #d9dee7;
  box-shadow: 0 16px 50px rgba(23, 26, 31, 0.12);
  overflow: hidden;
}
.container {
  gap: var(--gap, 0px);
  padding: var(--padding, 0px);
  align-items: var(--align, stretch);
  justify-content: var(--justify, flex-start);
}
.container-stack {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.container-row {
  display: flex;
  flex-direction: row;
  height: 100%;
}
.container-row > .container {
  flex: var(--width, 1) 1 0;
}
.container-grid {
  display: grid;
  grid-template-columns: repeat(var(--columns, auto-fit), minmax(180px, 1fr));
  height: 100%;
}
h1 {
  margin: 0;
  font-size: 44px;
  line-height: 1.06;
  letter-spacing: 0;
}
h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 520;
  line-height: 1.22;
  color: #515966;
  letter-spacing: 0;
}
h3 {
  margin: 0 0 8px;
  font-size: 19px;
  line-height: 1.2;
  letter-spacing: 0;
}
p, li, td, th {
  font-size: 19px;
  line-height: 1.42;
  letter-spacing: 0;
}
p { margin: 0; }
ul { margin: 0; padding-left: 26px; }
li + li { margin-top: 10px; }
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}
.card {
  border: 1px solid #d9dee7;
  border-radius: 8px;
  padding: 18px;
  background: #f9fafb;
}
.card p {
  font-size: 16px;
  color: #454d5a;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 10px 12px;
  border: 1px solid #d9dee7;
  text-align: left;
}
th { background: #f0f2f5; }
.image-placeholder {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 1px dashed #aab2c0;
  border-radius: 8px;
  color: #515966;
  text-align: center;
}
.image-placeholder figcaption {
  margin-top: 8px;
  font-size: 13px;
}
.chart {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid #d9dee7;
  border-radius: 8px;
  background: #f9fafb;
}
.chart-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-top: 1px solid #e4e8ef;
}
`;
