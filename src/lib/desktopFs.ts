import { invoke, isTauri } from "@tauri-apps/api/core";

export function runningInTauri() {
  if (typeof window === "undefined") return false;
  try {
    if (isTauri()) return true;
  } catch {
    // ignore
  }
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function formatUnknownError(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

function browserDownload(filename: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Revoking synchronously can cancel the download in Firefox and Safari.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Save text via native dialog in Tauri, or browser download otherwise. Returns false if cancelled. */
export async function saveTextAsFile(options: {
  defaultFilename: string;
  contents: string;
  mimeType: string;
  filterName: string;
  extensions: string[];
}): Promise<boolean> {
  if (!runningInTauri()) {
    browserDownload(options.defaultFilename, options.contents, options.mimeType);
    return true;
  }

  return invoke<boolean>("save_text_file", {
    defaultName: options.defaultFilename,
    contents: options.contents,
    filterName: options.filterName,
    extensions: options.extensions,
  });
}

/** Save binary via native dialog in Tauri, or browser download otherwise. Returns false if cancelled. */
export async function saveBytesAsFile(options: {
  defaultFilename: string;
  contents: Uint8Array;
  mimeType: string;
  filterName: string;
  extensions: string[];
}): Promise<boolean> {
  if (!runningInTauri()) {
    browserDownload(options.defaultFilename, options.contents as BlobPart, options.mimeType);
    return true;
  }

  return invoke<boolean>("save_bytes_file", {
    defaultName: options.defaultFilename,
    contents: Array.from(options.contents),
    filterName: options.filterName,
    extensions: options.extensions,
  });
}

/** Open and read a backup via Rust async dialog (safe on macOS). The filter lives in Rust. */
export async function openTextFileWithDialog(): Promise<string | null> {
  if (!runningInTauri()) return null;
  return invoke<string | null>("pick_and_read_backup");
}

export async function confirmAction(message: string): Promise<boolean> {
  const { appConfirm } = await import("@/lib/appDialog");
  return appConfirm(message, "LEDGER");
}
