use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

fn path_from_dialog(file_path: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
  file_path
    .into_path()
    .map_err(|e| format!("Could not resolve file path: {e}"))
}

/// Async on purpose: runs off the UI thread so blocking_pick_file does not deadlock.
#[tauri::command]
async fn pick_and_read_backup(app: AppHandle) -> Result<Option<String>, String> {
  let file_path = app
    .dialog()
    .file()
    .add_filter("LEDGER backup", &["json"])
    .blocking_pick_file();

  let Some(file_path) = file_path else {
    return Ok(None);
  };

  let path = path_from_dialog(file_path)?;
  std::fs::read_to_string(&path).map(Some).map_err(|e| {
    format!(
      "Could not read {}: {e}",
      path.file_name().and_then(|n| n.to_str()).unwrap_or("file")
    )
  })
}

#[tauri::command]
async fn save_text_file(
  app: AppHandle,
  default_name: String,
  contents: String,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<bool, String> {
  let ext_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
  let mut dialog = app.dialog().file().set_file_name(&default_name);
  if !ext_refs.is_empty() {
    dialog = dialog.add_filter(&filter_name, &ext_refs);
  }

  let Some(file_path) = dialog.blocking_save_file() else {
    return Ok(false);
  };

  let path = path_from_dialog(file_path)?;
  std::fs::write(&path, contents).map_err(|e| format!("Could not write file: {e}"))?;
  Ok(true)
}

#[tauri::command]
async fn save_bytes_file(
  app: AppHandle,
  default_name: String,
  contents: Vec<u8>,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<bool, String> {
  let ext_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
  let mut dialog = app.dialog().file().set_file_name(&default_name);
  if !ext_refs.is_empty() {
    dialog = dialog.add_filter(&filter_name, &ext_refs);
  }

  let Some(file_path) = dialog.blocking_save_file() else {
    return Ok(false);
  };

  let path = path_from_dialog(file_path)?;
  std::fs::write(&path, contents).map_err(|e| format!("Could not write file: {e}"))?;
  Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      pick_and_read_backup,
      save_text_file,
      save_bytes_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
