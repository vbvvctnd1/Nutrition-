import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { Column, Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type {
  ClientProfile,
  FoodItem,
  NutritionPlan,
  PdfDisplayFormat,
  TrainerSettings,
} from "../types/nutrition";
import { GOAL_LABELS, PREPARATION_STATE_LABELS, VARIETY_MODE_LABELS } from "../data/labels";
import {
  calculateDayTotals,
  calculateMealTotals,
  formatHouseholdMeasurement,
} from "./mealMath";

let fontsInitialized = false;

function ensurePdfFonts() {
  if (fontsInitialized) return;
  const fontModule = pdfFonts as unknown as {
    pdfMake?: { vfs?: Record<string, string> };
    vfs?: Record<string, string>;
    default?: { vfs?: Record<string, string>; pdfMake?: { vfs?: Record<string, string> } };
  };
  const vfs =
    fontModule.pdfMake?.vfs ||
    fontModule.vfs ||
    fontModule.default?.pdfMake?.vfs ||
    fontModule.default?.vfs ||
    (pdfFonts as unknown as Record<string, string>);

  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(vfs);
  } else {
    (pdfMake as unknown as { vfs: Record<string, string> }).vfs = vfs;
  }
  fontsInitialized = true;
}

function formatIngredientQuantity(
  food: FoodItem | undefined,
  grams: number,
  format: PdfDisplayFormat
): string {
  const roundedGrams = Math.round(grams);
  const household = formatHouseholdMeasurement(food, roundedGrams);

  if (format === "grams") {
    return `${roundedGrams} г`;
  }
  if (format === "household") {
    return household ? household : `${roundedGrams} г`;
  }
  // format === "both"
  return household ? `${roundedGrams} г (${household})` : `${roundedGrams} г`;
}

export function buildNutritionPdfDefinition(
  plan: NutritionPlan,
  client: ClientProfile,
  foodsMap: Map<string, FoodItem>,
  settings: TrainerSettings,
  format: PdfDisplayFormat
): TDocumentDefinitions {
  const content: Content[] = [];

  // PAGE 1 — CLIENT OVERVIEW
  const headerColumns: Column[] = [];
  if (settings.logoDataUrl) {
    headerColumns.push({
      image: settings.logoDataUrl,
      width: 56,
      margin: [0, 0, 14, 0],
    });
  }
  headerColumns.push({
    stack: [
      {
        text: settings.brandTitle || "Персональный план питания",
        style: "brandTitle",
      },
      {
        text: `Тренер: ${settings.trainerName || "Персональный тренер"}`,
        style: "muted",
        margin: [0, 2, 0, 0],
      },
    ],
    width: "*",
  });

  content.push({
    columns: headerColumns,
    margin: [0, 0, 0, 18],
  });

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#E5E7EB" }],
    margin: [0, 0, 0, 18],
  });

  content.push({
    text: plan.title || "Персональный рацион питания",
    style: "docTitle",
    margin: [0, 0, 0, 6],
  });

  content.push({
    text: `Формат программы: ${plan.durationType === "monthly" ? "План на месяц (4 недели)" : "План на неделю (7 дней)"} · Режим: ${VARIETY_MODE_LABELS[plan.varietyMode]}`,
    style: "muted",
    margin: [0, 0, 0, 20],
  });

  content.push({
    text: "Профиль клиента",
    style: "sectionHeader",
    margin: [0, 0, 0, 8],
  });

  content.push({
    table: {
      widths: ["35%", "65%"],
      body: [
        [{ text: "Клиент", style: "tableLabel" }, { text: client.fullName, style: "tableValueBold" }],
        [{ text: "Основная цель", style: "tableLabel" }, { text: GOAL_LABELS[client.goal], style: "tableValue" }],
        [{ text: "Возраст", style: "tableLabel" }, { text: `${client.age} лет`, style: "tableValue" }],
        [{ text: "Рост / Вес", style: "tableLabel" }, { text: `${client.heightCm} см / ${client.weightKg} кг`, style: "tableValue" }],
        [{ text: "Приёмов пищи в день", style: "tableLabel" }, { text: `${client.mealsPerDay}`, style: "tableValue" }],
      ],
    },
    layout: {
      hLineWidth: () => 0.75,
      vLineWidth: () => 0,
      hLineColor: () => "#E5E7EB",
      paddingTop: () => 7,
      paddingBottom: () => 7,
    },
    margin: [0, 0, 0, 22],
  });

  content.push({
    text: "Ежедневные целевые ориентиры КБЖУ",
    style: "sectionHeader",
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: {
      widths: ["25%", "25%", "25%", "25%"],
      body: [
        [
          { text: "Калорийность", style: "kpiHeader", alignment: "center" },
          { text: "Белки", style: "kpiHeader", alignment: "center" },
          { text: "Жиры", style: "kpiHeader", alignment: "center" },
          { text: "Углеводы", style: "kpiHeader", alignment: "center" },
        ],
        [
          { text: `${plan.targets.calories} ккал`, style: "kpiValue", alignment: "center" },
          { text: `${plan.targets.protein} г`, style: "kpiValue", alignment: "center" },
          { text: `${plan.targets.fat} г`, style: "kpiValue", alignment: "center" },
          { text: `${plan.targets.carbs} г`, style: "kpiValue", alignment: "center" },
        ],
      ],
    },
    layout: {
      fillColor: (rowIndex) => (rowIndex === 0 ? "#F3F4F6" : "#FFFFFF"),
      hLineWidth: () => 0.75,
      vLineWidth: () => 0.75,
      hLineColor: () => "#E5E7EB",
      vLineColor: () => "#E5E7EB",
      paddingTop: () => 9,
      paddingBottom: () => 9,
    },
    margin: [0, 0, 0, 16],
  });

  if (format === "household") {
    content.push({
      text: "Примечание по единицам измерения: объёмы и бытовые меры (ложки, штуки, порции) указаны приблизительно для удобства в быту. Калорийность и БЖУ рассчитаны на основе точной массы продуктов.",
      style: "noteBox",
      margin: [0, 6, 0, 12],
    });
  }

  if (client.allergies.length > 0 || client.restrictions.length > 0) {
    content.push({
      text: `Учтённые ограничения и аллергии: ${[...client.allergies, ...client.restrictions].join(", ")}`,
      style: "muted",
      margin: [0, 8, 0, 0],
    });
  }

  // PAGE 2 AND FOLLOWING — MEAL PLAN DAYS
  plan.days.forEach((day) => {
    content.push({
      text: day.dayLabel || `День ${day.dayNumber}`,
      style: "dayTitle",
      pageBreak: "before",
      margin: [0, 0, 0, 12],
    });

    const dayTotals = calculateDayTotals(day, foodsMap);

    day.meals.forEach((meal) => {
      const mealTotals = calculateMealTotals(meal, foodsMap);

      const ingredientRows = meal.ingredients.map((ing) => {
        const food = foodsMap.get(ing.foodId);
        const stateLabel = food ? PREPARATION_STATE_LABELS[food.preparationState].toLowerCase() : "";
        const displayName = food
          ? `${food.name}${food.brand ? ` (${food.brand})` : ""}`
          : "Продукт";
        const qtyStr = formatIngredientQuantity(food, ing.grams, format);
        return [
          { text: displayName, style: "ingName" },
          { text: stateLabel, style: "ingState" },
          { text: qtyStr, style: "ingQty", alignment: "right" as const },
        ];
      });

      const mealHeaderText = meal.isBatchPrepped && meal.batchNote
        ? `${meal.name}  ·  ${meal.batchNote}`
        : meal.name;

      content.push({
        unbreakable: true,
        stack: [
          {
            columns: [
              { text: mealHeaderText, style: "mealTitle", width: "*" },
              {
                text: `${mealTotals.calories} ккал  ·  Б ${mealTotals.protein} · Ж ${mealTotals.fat} · У ${mealTotals.carbs}`,
                style: "mealMacros",
                width: "auto",
                alignment: "right",
              },
            ],
            margin: [0, 0, 0, 6],
          },
          {
            table: {
              widths: ["*", 85, 130],
              body: ingredientRows.length > 0
                ? ingredientRows
                : [[{ text: "Ингредиенты не добавлены", colSpan: 3, style: "muted" }, {}, {}]],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => "#F1F5F9",
              paddingTop: () => 5,
              paddingBottom: () => 5,
              paddingLeft: () => 4,
              paddingRight: () => 4,
            },
          },
          ...(meal.instructions
            ? [
                {
                  text: `Приготовление: ${meal.instructions}`,
                  style: "instructions",
                  margin: [0, 5, 0, 0] as [number, number, number, number],
                },
              ]
            : []),
        ],
        margin: [0, 0, 0, 14],
      });
    });

    content.push({
      table: {
        widths: ["*", "auto"],
        body: [
          [
            { text: `Итого за ${day.dayLabel || `День ${day.dayNumber}`}`, style: "daySummaryLabel" },
            {
              text: `${dayTotals.calories} ккал  |  Белки: ${dayTotals.protein} г  ·  Жиры: ${dayTotals.fat} г  ·  Углеводы: ${dayTotals.carbs} г`,
              style: "daySummaryValue",
              alignment: "right",
            },
          ],
        ],
      },
      layout: {
        fillColor: () => "#F3F4F6",
        hLineWidth: () => 0.75,
        vLineWidth: () => 0.75,
        hLineColor: () => "#D1D5DB",
        vLineColor: () => "#D1D5DB",
        paddingTop: () => 8,
        paddingBottom: () => 8,
        paddingLeft: () => 10,
        paddingRight: () => 10,
      },
      margin: [0, 6, 0, 0],
    });
  });

  // FINAL PAGE — RECOMMENDATIONS & TRAINER CONTACTS
  content.push({
    text: "Рекомендации и инструкции",
    style: "dayTitle",
    pageBreak: "before",
    margin: [0, 0, 0, 14],
  });

  const recsText = (plan.trainerRecommendations || settings.defaultRecommendations || "").trim();
  if (recsText) {
    content.push({
      text: "Практические инструкции",
      style: "sectionHeader",
      margin: [0, 0, 0, 6],
    });
    content.push({
      text: recsText,
      style: "bodyText",
      margin: [0, 0, 0, 18],
    });
  }

  if (plan.trainerComments?.trim()) {
    content.push({
      text: "Комментарий тренера",
      style: "sectionHeader",
      margin: [0, 0, 0, 6],
    });
    content.push({
      text: plan.trainerComments.trim(),
      style: "bodyText",
      margin: [0, 0, 0, 18],
    });
  }

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#E5E7EB" }],
    margin: [0, 16, 0, 16],
  });

  content.push({
    stack: [
      { text: settings.brandTitle || "Персональный тренинг и нутрициология", style: "brandTitle" },
      { text: settings.trainerName || "Персональный тренер", style: "tableValueBold", margin: [0, 4, 0, 2] },
      { text: settings.contactInfo || "", style: "muted" },
    ],
  });

  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 44],
    footer: (currentPage, pageCount) => ({
      text: `${settings.trainerName ? settings.trainerName + " · " : ""}Страница ${currentPage} из ${pageCount}`,
      alignment: "right",
      fontSize: 8.5,
      color: "#6B7280",
      margin: [40, 10, 40, 0],
    }),
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#111827",
      lineHeight: 1.35,
    },
    styles: {
      brandTitle: { fontSize: 12, bold: true, color: "#065F46" },
      docTitle: { fontSize: 20, bold: true, color: "#111827" },
      dayTitle: { fontSize: 16, bold: true, color: "#111827" },
      sectionHeader: { fontSize: 12, bold: true, color: "#1F2937" },
      mealTitle: { fontSize: 11, bold: true, color: "#111827" },
      mealMacros: { fontSize: 9.5, color: "#065F46", bold: true },
      tableLabel: { fontSize: 9.5, color: "#6B7280" },
      tableValue: { fontSize: 10, color: "#111827" },
      tableValueBold: { fontSize: 10, bold: true, color: "#111827" },
      kpiHeader: { fontSize: 9, color: "#4B5563", bold: true },
      kpiValue: { fontSize: 13, bold: true, color: "#111827" },
      ingName: { fontSize: 9.5, color: "#111827" },
      ingState: { fontSize: 8.5, color: "#6B7280" },
      ingQty: { fontSize: 9.5, bold: true, color: "#111827" },
      instructions: { fontSize: 8.5, italics: true, color: "#4B5563" },
      daySummaryLabel: { fontSize: 10, bold: true, color: "#111827" },
      daySummaryValue: { fontSize: 10, bold: true, color: "#065F46" },
      noteBox: { fontSize: 9, italics: true, color: "#4B5563" },
      bodyText: { fontSize: 10, color: "#1F2937", lineHeight: 1.45 },
      muted: { fontSize: 9.5, color: "#6B7280" },
    },
    content,
  };
}

export async function generatePdfBlob(
  plan: NutritionPlan,
  client: ClientProfile,
  foodsMap: Map<string, FoodItem>,
  settings: TrainerSettings,
  format: PdfDisplayFormat
): Promise<Blob> {
  ensurePdfFonts();
  const docDef = buildNutritionPdfDefinition(plan, client, foodsMap, settings, format);
  const pdfDoc = pdfMake.createPdf(docDef);
  return await pdfDoc.getBlob();
}

export async function downloadNutritionPdf(
  plan: NutritionPlan,
  client: ClientProfile,
  foodsMap: Map<string, FoodItem>,
  settings: TrainerSettings,
  format: PdfDisplayFormat
): Promise<void> {
  const blob = await generatePdfBlob(plan, client, foodsMap, settings, format);
  const safeName = client.fullName.trim().replace(/\s+/g, "_").replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, "") || "client";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Рацион_${safeName}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareNutritionPdf(
  plan: NutritionPlan,
  client: ClientProfile,
  foodsMap: Map<string, FoodItem>,
  settings: TrainerSettings,
  format: PdfDisplayFormat
): Promise<{ shared: boolean; fallbackDownloaded: boolean }> {
  const blob = await generatePdfBlob(plan, client, foodsMap, settings, format);
  const safeName = client.fullName.trim().replace(/\s+/g, "_").replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, "") || "client";
  const fileName = `Рацион_${safeName}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const canShareFiles =
      typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    if (canShareFiles) {
      await navigator.share({
        title: `План питания: ${client.fullName}`,
        text: `Персональный рацион (${plan.targets.calories} ккал)`,
        files: [file],
      });
      return { shared: true, fallbackDownloaded: false };
    }
  }

  // Fallback: download file
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false, fallbackDownloaded: true };
}
