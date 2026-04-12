use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, PhysicalPosition};
use tauri::WindowEvent;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    // 如果启用了 dialog: true (tauri.conf.json 中)，
    // 这行 check() 被调用时，如果发现新版本，会自动弹窗询问用户是否更新。
    // 用户同意后会自动下载、覆盖并重启。
    match updater.check().await {
        Ok(Some(update)) => {
            println!("发现新版本: {}", update.version);
            // 由于 dialog: true，Tauri 会自己接管后续的下载和重启，我们只需要调用 check 触发即可。
        }
        Ok(None) => {
            println!("当前已是最新版本");
        }
        Err(e) => {
            println!("检查更新失败: {}", e);
            return Err(e.to_string());
        }
    }
    Ok(())
}

#[tauri::command]
fn trigger_summon(app: tauri::AppHandle, payload: String) {
    if let Some(summon_win) = app.get_webview_window("summon") {
        summon_win.eval(&format!("window.dispatchSummonEvent('{}')", payload)).ok();
        summon_win.show().unwrap();
        summon_win.set_always_on_top(true).unwrap();
        summon_win.set_focus().unwrap();
    }
}

#[tauri::command]
fn hide_main_show_floating(app: tauri::AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().unwrap();
    }
    if let Some(floating_win) = app.get_webview_window("floating") {
        // Position at top right
        if let Ok(Some(monitor)) = floating_win.current_monitor() {
            let size = monitor.size();
            // 100x100 window size, padding 100px from top and right (不需要太靠边)
            let x = size.width.saturating_sub(200);
            let y = 100;
            floating_win.set_position(PhysicalPosition::new(x, y)).unwrap();
        }
        floating_win.show().unwrap();
        floating_win.set_always_on_top(true).unwrap();
    }
}

#[tauri::command]
fn restore_main(app: tauri::AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().unwrap();
        main_win.unminimize().unwrap();
        main_win.set_focus().unwrap();
    }
    if let Some(floating_win) = app.get_webview_window("floating") {
        floating_win.hide().unwrap();
    }
}

#[tauri::command]
fn hide_summon(app: tauri::AppHandle) {
    if let Some(summon_win) = app.get_webview_window("summon") {
        summon_win.hide().unwrap();
    }
}

#[tauri::command]
fn test_summon(app: tauri::AppHandle) {
    let mock_payload = r#"[{\"studentName\":\"测试学生张三\",\"message\":\"请立即到办公室一趟！\"}]"#;
    if let Some(summon_win) = app.get_webview_window("summon") {
        summon_win.eval(&format!("window.dispatchSummonEvent('{}')", mock_payload)).ok();
        summon_win.show().unwrap();
        summon_win.set_always_on_top(true).unwrap();
        summon_win.set_focus().unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![trigger_summon, test_summon, hide_main_show_floating, restore_main, hide_summon, check_for_updates])
        .setup(|app| {
            let _main_window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("https://epet.school".parse().unwrap())
            )
            .title("校园灵宠")
            .inner_size(1280.0, 800.0)
            .center()
            .initialization_script(r#"
                window.addEventListener('DOMContentLoaded', () => {
                    const OriginalEventSource = window.EventSource;
                    if (OriginalEventSource) {
                        window.EventSource = function(url, options) {
                            const es = new OriginalEventSource(url, options);
                            es.addEventListener('summon', (e) => {
                                if (window.__TAURI_INTERNALS__) {
                                    // 转义可能存在的特殊字符
                                    const safeData = e.data.replace(/'/g, "\\'").replace(/"/g, '\\"');
                                    window.__TAURI_INTERNALS__.invoke('trigger_summon', { payload: safeData });
                                }
                            });
                            return es;
                        };
                    }
                    
                    // 劫持关闭按钮点击
                    document.addEventListener('click', (e) => {
                        const target = e.target;
                        if (target && target.closest && target.closest('[title="最小化为桌面悬浮窗"]')) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.__TAURI_INTERNALS__) {
                                window.__TAURI_INTERNALS__.invoke('hide_main_show_floating');
                            }
                        }
                        // 如果你页面上有更新按钮，也可以这样劫持触发：
                        // if (target && target.closest && target.closest('#update-btn')) {
                        //    window.__TAURI_INTERNALS__.invoke('check_for_updates');
                        // }
                    }, true);

                    // 启动时自动检查更新
                    if (window.__TAURI_INTERNALS__) {
                        setTimeout(() => {
                            window.__TAURI_INTERNALS__.invoke('check_for_updates');
                        }, 5000); // 延迟 5 秒检查，不阻碍主界面加载
                    }
                });
            "#)
            .build()
            .unwrap();

            let _floating_window = WebviewWindowBuilder::new(
                app,
                "floating",
                WebviewUrl::App("/floating".into())
            )
            .title("悬浮窗")
            .inner_size(80.0, 80.0)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .resizable(false)
            .visible(false)
            .skip_taskbar(true)
            .build()
            .unwrap();

            let _summon_window = WebviewWindowBuilder::new(
                app,
                "summon",
                WebviewUrl::App("/summon".into())
            )
            .title("传唤弹框")
            .inner_size(500.0, 480.0)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .resizable(false)
            .visible(false)
            .center()
            .build()
            .unwrap();

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::Resized(_) = event {
                    let is_minimized = window.is_minimized().unwrap_or(false);
                    if is_minimized {
                        if let Some(floating) = window.app_handle().get_webview_window("floating") {
                            if let Ok(Some(monitor)) = floating.current_monitor() {
                                let size = monitor.size();
                                let x = size.width.saturating_sub(200);
                                let y = 100;
                                floating.set_position(PhysicalPosition::new(x, y)).unwrap();
                            }
                            floating.show().unwrap();
                            floating.set_always_on_top(true).unwrap();
                        }
                    } else {
                        // MacOS 特有：当窗口通过点击 Dock 栏图标恢复时
                        if let Some(floating) = window.app_handle().get_webview_window("floating") {
                            floating.hide().unwrap();
                        }
                    }
                } else if let WindowEvent::CloseRequested { api, .. } = event {
                    // 拦截关闭事件，转为隐藏主窗口显示悬浮窗
                    api.prevent_close();
                    window.hide().unwrap();
                    if let Some(floating) = window.app_handle().get_webview_window("floating") {
                        if let Ok(Some(monitor)) = floating.current_monitor() {
                            let size = monitor.size();
                            let x = size.width.saturating_sub(200);
                            let y = 100;
                            floating.set_position(PhysicalPosition::new(x, y)).unwrap();
                        }
                        floating.show().unwrap();
                        floating.set_always_on_top(true).unwrap();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
