import React, { useEffect, useState } from "react";
import { X, Download, Share2, Check } from "lucide-react";
import type {
  ClientProfile,
  FoodItem,
  NutritionPlan,
  PdfDisplayFormat,
  TrainerSettings,
} from "../types/nutrition";
import { PDF_FORMAT_LABELS } from "../data/labels";
import {
  downloadNutritionPdf,
  generatePdfBlob,
  shareNutritionPdf,
} from "../utils/pdfExport";

interface PdfPreviewModalProps {
  plan: NutritionPlan;
  client: ClientProfile;
  foodsMap: Map<string, FoodItem>;
  settings: TrainerSettings;
  onUpdatePlanMeta: (recommendations: string, comments: string) => void;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  plan,
  client,
  foodsMap,
  settings,
  onUpdatePlanMeta,
  onClose,
}) => {
  const [format, setFormat] = useState<PdfDisplayFormat>(settings.defaultPdfFormat || "both");
  const [recommendations, setRecommendations] = useState(
    plan.trainerRecommendations || settings.defaultRecommendations
  );
  const [comments, setComments] = useState(plan.trainerComments || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectivePlan: NutritionPlan = {
    ...plan,
    trainerRecommendations: recommendations,
    trainerComments: comments,
  };

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;

    const buildPreview = async () => {
      setIsGenerating(true);
      setError(null);
      try {
        const blob = await generatePdfBlob(
          {
            ...plan,
            trainerRecommendations: recommendations,
            trainerComments: comments,
          },
          client,
          foodsMap,
          settings,
          format
        );
        if (!active) return;
        currentUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return currentUrl;
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Не удалось сформировать предпросмотр PDF.");
        }
      } finally {
        if (active) setIsGenerating(false);
      }
    };

    const timer = setTimeout(buildPreview, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [plan, client, foodsMap, settings, format, recommendations, comments]);

  const handleDownload = async () => {
    onUpdatePlanMeta(recommendations, comments);
    try {
      await downloadNutritionPdf(effectivePlan, client, foodsMap, settings, format);
      setStatusMessage("PDF-файл успешно скачан.");
    } catch {
      setError("Ошибка при скачивании PDF.");
    }
  };

  const handleShare = async () => {
    onUpdatePlanMeta(recommendations, comments);
    try {
      const res = await shareNutritionPdf(effectivePlan, client, foodsMap, settings, format);
      if (res.shared) {
        setStatusMessage("Документ отправлен через системное меню.");
      } else {
        setStatusMessage("Функция быстрой отправки не поддерживается этим браузером — файл PDF скачан на устройство.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Не удалось поделиться файлом. Попробуйте скачать PDF.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              Экспорт рациона в PDF
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Клиент: {client.fullName} · {plan.days.length} дн.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Controls */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-neutral-200 p-5 overflow-y-auto space-y-5">
            <div>
              <span className="text-xs font-semibold text-neutral-800 block mb-2">
                Формат отображения порций
              </span>
              <div className="space-y-2">
                {(Object.keys(PDF_FORMAT_LABELS) as PdfDisplayFormat[]).map((fmt) => (
                  <label
                    key={fmt}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      format === fmt
                        ? "border-emerald-600 bg-emerald-50/60 text-neutral-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pdfFormat"
                      checked={format === fmt}
                      onChange={() => setFormat(fmt)}
                      className="mt-0.5 accent-emerald-700"
                    />
                    <span>{PDF_FORMAT_LABELS[fmt]}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-neutral-800">
                Рекомендации тренера (финальная страница)
              </span>
              <textarea
                rows={5}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs leading-relaxed focus:border-emerald-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-neutral-800">
                Индивидуальный комментарий для клиента
              </span>
              <textarea
                rows={3}
                placeholder="Например: На следующей неделе обсудим самочувствие на тренировках и скорректируем порции."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs leading-relaxed focus:border-emerald-600 focus:outline-none"
              />
            </label>

            {statusMessage ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            ) : null}

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Скачать PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Отправить / Поделиться</span>
              </button>
            </div>
          </div>

          {/* Right Live PDF Preview */}
          <div className="lg:col-span-8 bg-neutral-100 flex flex-col min-h-[300px]">
            <div className="px-4 py-2 bg-white border-b border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
              <span>Предпросмотр PDF-документа</span>
              {isGenerating ? <span>Обновление макета...</span> : null}
            </div>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Предпросмотр PDF рациона"
                className="w-full flex-1 border-0"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
                Формирование PDF-документа...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
