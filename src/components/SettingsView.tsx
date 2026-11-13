import React, { useEffect, useRef, useState } from "react";
import { Download, Upload, Trash2, Check, AlertTriangle } from "lucide-react";
import type {
  AppBackupPayload,
  PdfDisplayFormat,
  TrainerSettings,
} from "../types/nutrition";
import { PDF_FORMAT_LABELS } from "../data/labels";
import { storageRepo } from "../utils/storage";
import { aiService, type GeminiStatusResponse } from "../services/aiService";

interface SettingsViewProps {
  settings: TrainerSettings;
  onSaveSettings: (next: TrainerSettings) => void;
  onRestoreBackup: (payload: AppBackupPayload) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onRestoreBackup,
}) => {
  const [form, setForm] = useState<TrainerSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  const [geminiStatus, setGeminiStatus] = useState<GeminiStatusResponse | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<AppBackupPayload | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    aiService.checkStatus().then(setGeminiStatus);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setBackupError("Размер логотипа не должен превышать 1 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportBackup = () => {
    const payload = storageRepo.exportBackup();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nutriplan_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice("Резервная копия всех данных сохранена в файл.");
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBackupError(null);
    setBackupNotice(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = storageRepo.validateBackup(parsed);
      if (!check.valid) {
        setBackupError(check.error);
        return;
      }
      setPendingRestore(check.data);
    } catch {
      setBackupError("Не удалось прочитать JSON-файл резервной копии.");
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    onRestoreBackup(pendingRestore);
    setForm(pendingRestore.settings);
    setPendingRestore(null);
    setBackupNotice("Данные успешно восстановлены из резервной копии.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Настройки</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Профиль тренера, оформление PDF-документов, резервное копирование и интеграция Gemini AI.
        </p>
      </div>

      {/* Trainer Profile & Branding */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5"
      >
        <h2 className="text-base font-semibold text-neutral-900">
          Профиль тренера и брендинг PDF
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Имя тренера</span>
            <input
              type="text"
              value={form.trainerName}
              onChange={(e) => setForm({ ...form, trainerName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Название студии / бренда</span>
            <input
              type="text"
              value={form.brandTitle}
              onChange={(e) => setForm({ ...form, brandTitle: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-neutral-700">Контактная информация (для PDF)</span>
            <input
              type="text"
              value={form.contactInfo}
              onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
        </div>

        {/* Logo upload */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-neutral-700 block">Логотип (PNG/JPG для PDF и шапки)</span>
          <div className="flex items-center gap-4">
            {form.logoDataUrl ? (
              <img
                src={form.logoDataUrl}
                alt="Логотип"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-lg object-cover border border-neutral-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center text-[11px] text-neutral-400">
                Нет
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700"
              >
                Загрузить логотип
              </button>
              {form.logoDataUrl ? (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logoDataUrl: undefined })}
                  className="p-1.5 text-neutral-400 hover:text-red-600"
                  aria-label="Удалить логотип"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Default PDF Preferences */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">
              Формат порций в PDF по умолчанию
            </span>
            <select
              value={form.defaultPdfFormat}
              onChange={(e) =>
                setForm({ ...form, defaultPdfFormat: e.target.value as PdfDisplayFormat })
              }
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {(Object.keys(PDF_FORMAT_LABELS) as PdfDisplayFormat[]).map((fmt) => (
                <option key={fmt} value={fmt}>
                  {PDF_FORMAT_LABELS[fmt]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-700">
              Стандартные рекомендации для финальной страницы PDF
            </span>
            <textarea
              rows={4}
              value={form.defaultRecommendations}
              onChange={(e) => setForm({ ...form, defaultRecommendations: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs leading-relaxed focus:border-emerald-600 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          {savedNotice ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check className="w-4 h-4" />
              <span>Настройки сохранены</span>
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
          >
            Сохранить настройки
          </button>
        </div>
      </form>

      {/* Backup & Restore */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Резервное копирование и восстановление данных
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Все клиенты, база продуктов, сохранённые рационы и настройки хранятся локально в браузере. Регулярно экспортируйте резервную копию.
          </p>
        </div>

        {backupError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-800">
            {backupError}
          </div>
        ) : null}

        {backupNotice ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-900">
            {backupNotice}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800"
          >
            <Download className="w-4 h-4" />
            <span>Скачать резервную копию (JSON)</span>
          </button>

          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleSelectBackupFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800"
          >
            <Upload className="w-4 h-4" />
            <span>Восстановить из файла</span>
          </button>
        </div>

        {pendingRestore ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Подтвердите замену текущих данных</div>
                <div className="mt-1 tabular-nums">
                  В резервной копии от {new Date(pendingRestore.exportedAt).toLocaleDateString("ru-RU")}:{" "}
                  клиентов — {pendingRestore.clients.length}, продуктов — {pendingRestore.foods.length}, рационов — {pendingRestore.plans.length}.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium"
              >
                Заменить данные
              </button>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="px-3.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-medium text-amber-900"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Gemini Integration Status (read-only, never asks for API key in UI) */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">Интеграция Gemini AI</h2>
        <div className="text-sm text-neutral-700">
          Состояние:{" "}
          {geminiStatus === null ? (
            <span className="text-neutral-400">Проверка...</span>
          ) : geminiStatus.configured ? (
            <span className="font-medium text-emerald-700">
              Подключено (серверный ключ активен · модель {geminiStatus.model})
            </span>
          ) : (
            <span className="font-medium text-amber-700">
              Серверный ключ не обнаружен — доступны все ручные функции, расчёты и экспорт PDF
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
