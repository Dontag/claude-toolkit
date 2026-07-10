use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // single-instance must be registered first so a second launch focuses
        // the running window (and forwards any deep link) instead of starting anew
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }));
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_deep_link::init());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(|app| {
            // Dev builds only: open devtools automatically. In release the
            // inspector is not compiled in at all (the `tauri` crate's
            // `devtools` feature is off in Cargo.toml and this call is gated
            // out), so production ships with no devtools / F12 / Inspect.
            #[cfg(debug_assertions)]
            if let Some(win) = app.get_webview_window("main") {
                win.open_devtools();
            }
            #[cfg(desktop)]
            {
                // Register the claude-toolkit:// scheme at runtime so OAuth deep
                // links work in `tauri dev` too (not just installed builds).
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            #[cfg(desktop)]
            {
                // Tray: hide-to-tray keeps the ~/.claude watcher alive in the background
                let show = MenuItem::with_id(app, "show", "Show Claude Galaxy", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;
                TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Claude Galaxy — watching your .claude folder")
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Release: hide to tray so the ~/.claude watcher keeps running.
                // Dev: fully exit, so `tauri dev` tears down Vite/ports and the
                // next build can replace the (otherwise locked) exe.
                #[cfg(debug_assertions)]
                {
                    let _ = api; // exit normally
                    window.app_handle().exit(0);
                }
                #[cfg(not(debug_assertions))]
                {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
