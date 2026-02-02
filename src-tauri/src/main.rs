// 防止 Windows release 版本出现额外控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_devtools::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
