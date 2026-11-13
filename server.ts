import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function mapGeminiError(err: unknown): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("429") || lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("rate limit")) {
    return {
      status: 429,
      code: "QUOTA_EXHAUSTED",
      message: "Превышен лимит запросов к Gemini API или исчерпана квота. Подождите немного и попробуйте снова.",
    };
  }
  if (lower.includes("403") || lower.includes("permission_denied") || lower.includes("api_key_invalid") || lower.includes("401")) {
    return {
      status: 403,
      code: "AUTH_ERROR",
      message: "Ошибка авторизации Gemini API. Проверьте ключ GEMINI_API_KEY в настройках секретов.",
    };
  }
  if (lower.includes("404") || lower.includes("not_found")) {
    return {
      status: 404,
      code: "MODEL_NOT_FOUND",
      message: "Выбранная модель Gemini временно недоступна.",
    };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return {
      status: 503,
      code: "NETWORK_ERROR",
      message: "Не удалось связаться с сервисом Gemini AI. Проверьте подключение и повторите попытку вручную.",
    };
  }
  return {
    status: 500,
    code: "GEMINI_ERROR",
    message: "Произошла ошибка при обращении к Gemini AI. Ваши данные сохранены, попробуйте повторить запрос.",
  };
}

interface CompactFoodCatalogItem {
  id: string;
  name: string;
  category: string;
  state: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Health & Gemini availability check (never exposes secret key)
  app.get("/api/gemini/status", (_req, res) => {
    const client = getGeminiClient();
    res.json({
      configured: Boolean(client),
      model: MODEL_NAME,
    });
  });

  // 1. Parse natural-language food habits in Russian
  app.post("/api/ai/parse-habits", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: "NOT_CONFIGURED",
        message: "Интеграция Gemini AI не настроена. Вы можете использовать ручной выбор продуктов.",
      });
    }

    const { description, catalog } = req.body as {
      description?: string;
      catalog?: CompactFoodCatalogItem[];
    };

    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "Введите описание привычного рациона клиента на русском языке.",
      });
    }

    const compactCatalog = (catalog || []).slice(0, 180).map((f) => ({
      id: f.id,
      name: f.name,
      state: f.state,
    }));

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          `Описание привычного питания клиента:\n"${description.trim()}"`,
          `\nДоступная проверенная база продуктов (JSON):\n${JSON.stringify(compactCatalog)}`,
        ].join("\n"),
        config: {
          systemInstruction:
            "Ты — ассистент тренера по питанию. Проанализируй русскоязычное описание привычного рациона клиента. " +
            "Разбей его на приёмы пищи (например: Завтрак, Обед, Ужин, Перекус). " +
            "Для каждого упомянутого продукта найди наиболее подходящий ID из переданной базы продуктов. " +
            "Если подходящего продукта в базе нет, оставь matchedFoodId пустым, а в unmatchedNote укажи, что продукт не найден в базе. " +
            "КРИТИЧЕСКИ ВАЖНО: Никогда не выдумывай отсутствующие граммовки или калорийность! " +
            "Если количество явно указано в тексте (например, '3 яйца', '150 г риса', '2 ложки масла'), укажи statedQuantityText и, если возможно, точную оценку в граммах (estimatedGrams, или null если количество НЕ указано). " +
            "Если количество не указано ('курица с рисом'), обязательно установи quantitySpecified: false и estimatedGrams: null.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    mealName: { type: Type.STRING, description: "Название приёма пищи на русском" },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          mentionedName: { type: Type.STRING, description: "Как продукт назван в описании" },
                          matchedFoodId: { type: Type.STRING, nullable: true, description: "ID из базы продуктов или null" },
                          quantitySpecified: { type: Type.BOOLEAN, description: "Указано ли количество в тексте" },
                          statedQuantityText: { type: Type.STRING, nullable: true, description: "Указанное количество (напр. '3 шт', '200 г') или null" },
                          estimatedGrams: { type: Type.NUMBER, nullable: true, description: "Граммы только если количество указано в тексте, иначе null" },
                          confidence: { type: Type.STRING, description: "high | medium | low" },
                        },
                        required: ["mentionedName", "quantitySpecified", "confidence"],
                      },
                    },
                  },
                  required: ["mealName", "items"],
                },
              },
              habitSummary: {
                type: Type.STRING,
                description: "Краткое резюме пищевых привычек (1-2 предложения на русском)",
              },
            },
            required: ["meals", "habitSummary"],
          },
        },
      });

      const text = (response.text ?? "{}").trim();
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      return res.status(mapped.status).json({ code: mapped.code, message: mapped.message });
    }
  });

  // 2. Suggest practical habit improvements
  app.post("/api/ai/suggest-improvements", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: "NOT_CONFIGURED",
        message: "Интеграция Gemini AI не настроена.",
      });
    }

    const { goal, targets, habitSummary, willingnessToChange, restrictions } = req.body as {
      goal: string;
      targets: { calories: number; protein: number; fat: number; carbs: number };
      habitSummary: string;
      willingnessToChange: string;
      restrictions: string[];
    };

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({ goal, targets, habitSummary, willingnessToChange, restrictions }),
        config: {
          systemInstruction:
            "Ты — методист по спортивному питанию. Предложи 3–5 практичных и бережных корректировок существующих пищевых привычек клиента на русском языке, " +
            "не ломая его привычный уклад (мягкие замены и добавки). Не придумывай вымышленных цифр КБЖУ. Кратко и по делу.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ["title", "action", "rationale"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      return res.status(mapped.status).json({ code: mapped.code, message: mapped.message });
    }
  });

  // 3. Generate Day 1 Meal Plan using ONLY verified catalog food IDs
  app.post("/api/ai/generate-day", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: "NOT_CONFIGURED",
        message: "Интеграция Gemini AI не настроена. Вы можете составить рацион вручную.",
      });
    }

    const {
      goal,
      targets,
      mealsPerDay,
      varietyMode,
      willingnessToChange,
      favoriteFoodNames,
      regularFoodNames,
      dislikedFoodNames,
      allergies,
      restrictions,
      habitSummary,
      catalog,
    } = req.body as {
      goal: string;
      targets: { calories: number; protein: number; fat: number; carbs: number };
      mealsPerDay: number;
      varietyMode: "moderate" | "batch";
      willingnessToChange: string;
      favoriteFoodNames: string[];
      regularFoodNames: string[];
      dislikedFoodNames: string[];
      allergies: string[];
      restrictions: string[];
      habitSummary: string;
      catalog: CompactFoodCatalogItem[];
    };

    // Send only safe, concise verified catalog items (filtered on client against allergies/disliked)
    const compactCatalog = (catalog || []).slice(0, 160);

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          goal,
          targets,
          mealsPerDay,
          varietyMode,
          willingnessToChange,
          favoriteFoodNames,
          regularFoodNames,
          dislikedFoodNames,
          allergies,
          restrictions,
          habitSummary,
          verifiedFoods: compactCatalog,
        }),
        config: {
          systemInstruction:
            "Ты — ассистент тренера по питанию. Составь реалистичный, доступный дневной рацион из указанного количества приёмов пищи (mealsPerDay) на русском языке. " +
            "Опирайся на привычки и любимые продукты клиента, адаптируя их под целевые КБЖУ, вместо того чтобы навязывать экзотическую диету. " +
            "СТРОГИЕ ПРАВИЛА: " +
            "1) Используй ТОЛЬКО продукты из переданного списка verifiedFoods, указывая точный foodId! Запрещено придумывать свои продукты или ID. " +
            "2) Строго исключи аллергены, нелюбимые и запрещённые продукты. " +
            "3) Обращай внимание на состояние приготовления (state: сырой/сухой или варёный/готовый), подбирай реалистичные порции (grams) для готового блюда. " +
            "4) Программа сама точно пересчитает граммы и КБЖУ по базе, но твои стартовые граммовки должны быть максимально близки к цели (calories, protein, fat, carbs). " +
            "5) Если varietyMode === 'batch', помечай блюда/гарниры, которые удобно готовить заранее на 2-3 дня (isBatchPrepped: true, batchNote).",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Название приёма пищи, напр. 'Завтрак: омлет с тостами'" },
                    instructions: { type: Type.STRING, description: "Короткий совет по приготовлению (1 предложение)" },
                    isBatchPrepped: { type: Type.BOOLEAN },
                    batchNote: { type: Type.STRING, nullable: true },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          foodId: { type: Type.STRING, description: "Точный ID продукта из verifiedFoods" },
                          grams: { type: Type.NUMBER, description: "Рекомендуемая порция в граммах" },
                        },
                        required: ["foodId", "grams"],
                      },
                    },
                  },
                  required: ["name", "ingredients"],
                },
              },
              rationale: {
                type: Type.STRING,
                description: "Краткое пояснение для тренера, как учтены привычки клиента",
              },
            },
            required: ["meals"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      return res.status(mapped.status).json({ code: mapped.code, message: mapped.message });
    }
  });

  // 4. Generate remaining days of the week based on approved Day 1
  app.post("/api/ai/generate-week", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: "NOT_CONFIGURED",
        message: "Интеграция Gemini AI не настроена. Вы можете скопировать и отредактировать дни вручную.",
      });
    }

    const {
      approvedDay1,
      daysToGenerate,
      targets,
      varietyMode,
      goal,
      allergies,
      restrictions,
      catalog,
    } = req.body as {
      approvedDay1: { meals: { name: string; ingredients: { foodName: string; grams: number }[] }[] };
      daysToGenerate: number;
      targets: { calories: number; protein: number; fat: number; carbs: number };
      varietyMode: "moderate" | "batch";
      goal: string;
      allergies: string[];
      restrictions: string[];
      catalog: CompactFoodCatalogItem[];
    };

    const compactCatalog = (catalog || []).slice(0, 160);

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          approvedDay1,
          daysToGenerate,
          targets,
          varietyMode,
          goal,
          allergies,
          restrictions,
          verifiedFoods: compactCatalog,
        }),
        config: {
          systemInstruction:
            `Ты — ассистент тренера по питанию. На основе утверждённого Дня 1 сгенерируй ${daysToGenerate} последующих дней (День 2 .. День ${daysToGenerate + 1}) на русском языке. ` +
            "Соблюдай режим разнообразия: " +
            "- Если varietyMode === 'moderate': умеренное разнообразие — базовые продукты (крупы, яйца, творог) могут повторяться, но блюда и сочетания меняются; без сложных ресторанных рецептов, только реалистичные доступные продукты. " +
            "- Если varietyMode === 'batch': режим заготовок (batch cooking) — основные белковые блюда и гарниры готовятся на 2–3 дня вперёд и повторяются в соседних днях, обязательно указывай isBatchPrepped: true и batchNote (например, 'Заготовка на 2 дня'). " +
            "СТРОГО: используй только foodId из verifiedFoods, полностью исключи аллергены и ограничения.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayNumber: { type: Type.INTEGER },
                    meals: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          instructions: { type: Type.STRING },
                          isBatchPrepped: { type: Type.BOOLEAN },
                          batchNote: { type: Type.STRING, nullable: true },
                          ingredients: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                foodId: { type: Type.STRING },
                                grams: { type: Type.NUMBER },
                              },
                              required: ["foodId", "grams"],
                            },
                          },
                        },
                        required: ["name", "ingredients"],
                      },
                    },
                  },
                  required: ["dayNumber", "meals"],
                },
              },
            },
            required: ["days"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      return res.status(mapped.status).json({ code: mapped.code, message: mapped.message });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NutriPlan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
