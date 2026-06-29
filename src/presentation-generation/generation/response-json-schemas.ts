const ELEMENT_TYPES = [
  "title",
  "subtitle",
  "text",
  "bullets",
  "image",
  "cards",
  "table",
  "chart",
];

const CONTAINER_COMMON_PROPERTIES = {
  id: { type: "string", minLength: 1 },
  slot: {
    type: "string",
    enum: ["title", "body", "visual", "data", "comment", "footer"],
  },
  accepts: {
    type: "array",
    minItems: 1,
    items: { type: "string", enum: ELEMENT_TYPES },
  },
  required: { type: "boolean" },
  gap: { type: "number", minimum: 0 },
  padding: { type: "number", minimum: 0 },
  align: { type: "string", enum: ["start", "center", "end", "stretch"] },
  justify: {
    type: "string",
    enum: ["start", "center", "end", "space_between"],
  },
  width: { type: "number", exclusiveMinimum: 0, maximum: 1 },
};

const ELEMENT_COMMON_PROPERTIES = {
  id: { type: "string", minLength: 1 },
  style: { type: "string", minLength: 1 },
  source_reference: { type: "string", minLength: 1 },
};

export const OutlineGenerationResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slides"],
  properties: {
    title: { type: "string", minLength: 1 },
    slides: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "title", "intent"],
        properties: {
          index: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          intent: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

export const PerSlideGenerationResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["template_id", "slide"],
  properties: {
    template_id: { type: "string", minLength: 1 },
    slide: { $ref: "#/$defs/slide" },
  },
  $defs: {
    slide: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "root_container"],
      properties: {
        id: { type: "string", minLength: 1 },
        type: { const: "slide" },
        root_container: { $ref: "#/$defs/layoutContainer" },
        source_reference: { type: "string", minLength: 1 },
      },
    },
    layoutChild: {
      anyOf: [
        { $ref: "#/$defs/layoutContainer" },
        { $ref: "#/$defs/element" },
      ],
    },
    layoutContainer: {
      anyOf: [
        { $ref: "#/$defs/stackContainer" },
        { $ref: "#/$defs/rowContainer" },
        { $ref: "#/$defs/gridContainer" },
      ],
    },
    stackContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "stack" },
        children: {
          type: "array",
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    rowContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "row" },
        children: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    gridContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "columns", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "grid" },
        columns: {
          anyOf: [
            { type: "integer", minimum: 1 },
            { const: "auto" },
          ],
        },
        children: {
          type: "array",
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    element: {
      anyOf: [
        { $ref: "#/$defs/titleElement" },
        { $ref: "#/$defs/subtitleElement" },
        { $ref: "#/$defs/textElement" },
        { $ref: "#/$defs/bulletsElement" },
        { $ref: "#/$defs/imageElement" },
        { $ref: "#/$defs/cardsElement" },
        { $ref: "#/$defs/tableElement" },
        { $ref: "#/$defs/chartElement" },
      ],
    },
    titleElement: textLikeElementSchema("title"),
    subtitleElement: textLikeElementSchema("subtitle"),
    textElement: textLikeElementSchema("text"),
    bulletsElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "items"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "bullets" },
        items: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    imageElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "asset_id", "alt"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "image" },
        asset_id: { type: "string", minLength: 1 },
        alt: { type: "string", minLength: 1 },
        fit: { type: "string", enum: ["cover", "contain", "fill"] },
      },
    },
    cardsElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "items"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "cards" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "text"],
            properties: {
              title: { type: "string", minLength: 1 },
              text: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
    tableElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "columns", "rows"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "table" },
        columns: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        rows: {
          type: "array",
          minItems: 1,
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    chartElement: {
      anyOf: [
        { $ref: "#/$defs/barChartElement" },
        { $ref: "#/$defs/lineChartElement" },
        { $ref: "#/$defs/pieChartElement" },
      ],
    },
    barChartElement: seriesChartElementSchema("bar"),
    lineChartElement: seriesChartElementSchema("line"),
    pieChartElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "chart_type", "slices"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "chart" },
        chart_type: { const: "pie" },
        slices: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "value"],
            properties: {
              label: { type: "string", minLength: 1 },
              value: { type: "number" },
            },
          },
        },
        unit: { type: "string", minLength: 1 },
      },
    },
  },
};

function textLikeElementSchema(type: "title" | "subtitle" | "text") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "text"],
    properties: {
      ...ELEMENT_COMMON_PROPERTIES,
      type: { const: type },
      text: { type: "string", minLength: 1 },
    },
  };
}

function seriesChartElementSchema(chartType: "bar" | "line") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "chart_type", "labels", "series"],
    properties: {
      ...ELEMENT_COMMON_PROPERTIES,
      type: { const: "chart" },
      chart_type: { const: chartType },
      labels: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
      series: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "values"],
          properties: {
            label: { type: "string", minLength: 1 },
            values: {
              type: "array",
              minItems: 1,
              items: { type: "number" },
            },
          },
        },
      },
      unit: { type: "string", minLength: 1 },
    },
  };
}
