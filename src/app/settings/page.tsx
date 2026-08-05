"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, RotateCcw, FileJson, FileSpreadsheet } from "lucide-react";
import { type ChangeEventHandler, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Modal from "@/components/Modal";
import IconBadge from "@/components/IconBadge";
import ColorPalettePicker from "@/components/ColorPalettePicker";
import { FormField, FormInput, FormRow, FormSelect } from "@/components/FormField";
import { expenseCategoryIconOptions, incomeCategoryIconOptions } from "@/lib/iconRegistry";
import { COLOR_PALETTE } from "@/lib/colorPalette";
import { useExpenseStore } from "@/store/expenseStore";
import { CategoryKind } from "@/lib/types";
import {
  downloadBackupJson,
  downloadExportCsv,
  downloadExportJson,
  parseBackupPayload,
  restoreFromBackupPayload,
} from "@/lib/dataPortability";
import {
  confirmAction,
  formatUnknownError,
  openTextFileWithDialog,
  runningInTauri,
} from "@/lib/desktopFs";

const categorySchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["income", "expense"]),
  name: z.string().min(1, "Name is required"),
  iconKey: z.string().min(1),
  color: z.string().min(1),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function SettingsPage() {
  const categories = useExpenseStore((s) => s.categories);
  const transactions = useExpenseStore((s) => s.transactions);
  const upsertCategory = useExpenseStore((s) => s.upsertCategory);
  const deleteCategory = useExpenseStore((s) => s.deleteCategory);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<null | "backup" | "restore" | "csv" | "json">(null);
  const [feedback, setFeedback] = useState<null | { kind: "success" | "error"; message: string }>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const incomeCategories = useMemo(() => categories.filter((c) => c.kind === "income"), [categories]);
  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      kind: "expense",
      name: "",
      iconKey: "expense_other",
      color: "#00d4aa",
    },
  });

  const openCreate = (kind: CategoryKind) => {
    setMode("create");
    setEditingId(null);
    form.reset({
      kind,
      name: "",
      iconKey: kind === "income" ? "income_other" : "expense_other",
      color: "#00d4aa",
    });
    setOpen(true);
  };

  const openEdit = (categoryId: string) => {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return;
    setMode("edit");
    setEditingId(categoryId);
    form.reset({
      id: c.id,
      kind: c.kind,
      name: c.name,
      iconKey: c.iconKey,
      color: c.color,
    });
    setOpen(true);
  };

  const onSubmit = async (values: CategoryFormValues) => {
    await upsertCategory({
      id: mode === "edit" ? editingId ?? undefined : undefined,
      kind: values.kind,
      name: values.name,
      iconKey: values.iconKey,
      color: values.color,
      system: false,
    });
    setOpen(false);
    setEditingId(null);
  };

  const onDelete = async (categoryId: string) => {
    const referenced = transactions.filter((tx) => tx.categoryId === categoryId).length;

    const { appConfirm } = await import("@/lib/appDialog");
    const ok = await appConfirm(
      referenced > 0
        ? `Delete this category? ${referenced} transaction${referenced === 1 ? "" : "s"} will become Uncategorized — none will be deleted.`
        : "Delete this category?"
    );
    if (!ok) return;
    await deleteCategory(categoryId);
  };

  const control = form.control;
  const watchedKind = useWatch({ control, name: "kind" });
  const watchedName = useWatch({ control, name: "name" });
  const watchedIconKey = useWatch({ control, name: "iconKey" });
  const watchedColor = useWatch({ control, name: "color" });

  const iconOptions = watchedKind === "income" ? incomeCategoryIconOptions : expenseCategoryIconOptions;

  const handleBackup = async () => {
    setLoadingAction("backup");
    setFeedback(null);
    try {
      await downloadBackupJson();
      setFeedback({ kind: "success", message: "Backup saved successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backup failed.";
      if (message.toLowerCase().includes("cancelled")) return;
      setFeedback({ kind: "error", message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportCsv = async () => {
    setLoadingAction("csv");
    setFeedback(null);
    try {
      await downloadExportCsv();
      setFeedback({ kind: "success", message: "CSV export saved successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV export failed.";
      if (message.toLowerCase().includes("cancelled")) return;
      setFeedback({ kind: "error", message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportJson = async () => {
    setLoadingAction("json");
    setFeedback(null);
    try {
      await downloadExportJson();
      setFeedback({ kind: "success", message: "JSON export saved successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON export failed.";
      if (message.toLowerCase().includes("cancelled")) return;
      setFeedback({ kind: "error", message });
    } finally {
      setLoadingAction(null);
    }
  };

  const applyRestoreFromRaw = async (raw: string, alreadyConfirmed = false) => {
    if (!alreadyConfirmed) {
      const confirmOverwrite = await confirmAction(
        "Restore will overwrite all current data. Continue?"
      );
      if (!confirmOverwrite) return;
    }

    setLoadingAction("restore");
    setFeedback(null);
    try {
      // Validate before touching the database, so a bad file can't half-restore.
      const payload = parseBackupPayload(JSON.parse(raw));
      await restoreFromBackupPayload(payload);
      await useExpenseStore.getState().loadAll({ force: true });
      setFeedback({
        kind: "success",
        message: `Restore successful. Loaded ${payload.transactions.length} transactions.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: formatUnknownError(error, "Restore failed."),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestorePick = () => {
    void (async () => {
      try {
        const confirmed = await confirmAction(
          "Restore will overwrite all current data. Continue?"
        );
        if (!confirmed) return;

        if (runningInTauri()) {
          setFeedback({ kind: "success", message: "Choose a backup JSON file…" });
          const raw = await openTextFileWithDialog();
          if (raw == null) {
            setFeedback(null);
            return;
          }
          await applyRestoreFromRaw(raw, true);
          return;
        }
        fileInputRef.current?.click();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: formatUnknownError(error, "Restore failed."),
        });
        setLoadingAction(null);
      }
    })();
  };

  const handleRestoreFile: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await applyRestoreFromRaw(await file.text());
  };

  return (
    <div className="space-y-8">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage categories and your data backups.</p>
      </header>

      {feedback && (
        <section
          className={[
            "rounded border px-4 py-3 text-sm",
            feedback.kind === "success"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          ].join(" ")}
        >
          {feedback.message}
        </section>
      )}

      <section className="app-card p-5">
        <h2 className="text-sm font-semibold">Backup &amp; restore</h2>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          Your data stays local. Keep backups before major changes.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-border bg-secondary/40 p-4">
            <h3 className="text-sm font-semibold">Backup your data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Save a complete backup file that you can restore later.
            </p>
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              onClick={() => void handleBackup()}
              disabled={loadingAction !== null}
            >
              <Download size={14} />
              {loadingAction === "backup" ? "Backing up..." : "Backup data"}
            </button>
          </div>

          <div className="rounded border border-border bg-secondary/40 p-4">
            <h3 className="text-sm font-semibold">Restore your data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Load a backup JSON and overwrite current app data.
            </p>
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              onClick={handleRestorePick}
              disabled={loadingAction !== null}
            >
              <RotateCcw size={14} />
              {loadingAction === "restore" ? "Restoring..." : "Restore data"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleRestoreFile}
            />
          </div>

          <div className="rounded border border-border bg-secondary/40 p-4">
            <h3 className="text-sm font-semibold">Export data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Export to CSV for sheets or JSON for raw data analysis.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleExportCsv()}
                disabled={loadingAction !== null}
              >
                <FileSpreadsheet size={14} />
                {loadingAction === "csv" ? "Exporting..." : "CSV"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleExportJson()}
                disabled={loadingAction !== null}
              >
                <FileJson size={14} />
                {loadingAction === "json" ? "Exporting..." : "JSON"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Categories</h2>
          <p className="mt-1 text-xs font-mono text-muted-foreground">
            Add, edit, and delete income or expense categories.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="app-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Income</h3>
                <p className="text-xs font-mono text-muted-foreground">{incomeCategories.length} categories</p>
              </div>
              <button type="button" className="btn-primary" onClick={() => openCreate("income")}>
                Add
              </button>
            </div>
            <ul className="divide-y divide-border">
              {incomeCategories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconBadge iconKey={c.iconKey} color={c.color} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-ghost" onClick={() => openEdit(c.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-destructive"
                      onClick={() => void onDelete(c.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="app-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Expense</h3>
                <p className="text-xs font-mono text-muted-foreground">{expenseCategories.length} categories</p>
              </div>
              <button type="button" className="btn-primary" onClick={() => openCreate("expense")}>
                Add
              </button>
            </div>
            <ul className="divide-y divide-border">
              {expenseCategories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconBadge iconKey={c.iconKey} color={c.color} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-ghost" onClick={() => openEdit(c.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-destructive"
                      onClick={() => void onDelete(c.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <Modal
        open={open}
        title={mode === "edit" ? "Edit Category" : "Add Category"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="category_form" className="btn-primary">
              Save
            </button>
          </>
        }
      >
        <form id="category_form" className="space-y-4" onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
          <FormRow>
            <FormField label="Kind">
              <FormSelect {...form.register("kind")}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </FormSelect>
            </FormField>
            <FormField label="Name" error={form.formState.errors.name?.message}>
              <FormInput {...form.register("name")} placeholder="Category name" />
            </FormField>
          </FormRow>

          <FormField label="Icon">
            <FormSelect {...form.register("iconKey")}>
              {iconOptions.map((opt) => (
                <option key={opt.iconKey} value={opt.iconKey}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="Color">
            <ColorPalettePicker
              value={watchedColor || COLOR_PALETTE[0]}
              onChange={(color) => form.setValue("color", color, { shouldValidate: true })}
            />
          </FormField>

          <div className="rounded border border-border bg-secondary p-3">
            <div className="form-label">Preview</div>
            <div className="mt-2 flex items-center gap-3">
              <IconBadge
                iconKey={watchedIconKey}
                color={watchedColor || COLOR_PALETTE[0]}
                size={20}
                boxSize={48}
              />
              <div>
                <div className="text-sm font-semibold">{watchedName || "Category name"}</div>
                <div className="mt-1 text-xs font-mono capitalize text-muted-foreground">
                  {watchedKind}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
