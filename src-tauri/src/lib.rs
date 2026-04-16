use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::WindowEvent;
use tauri::{Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientInstallReportDto {
    machine_id: String,
    os_type: String,
    os_version: String,
    arch: String,
    app_version: String,
    user_id: Option<i32>,
}

fn get_machine_id(app: &tauri::AppHandle) -> String {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    let id_file = app_dir.join("machine_id.txt");
    if id_file.exists() {
        if let Ok(id) = fs::read_to_string(&id_file) {
            let id = id.trim().to_string();
            if !id.is_empty() {
                return id;
            }
        }
    }
    let new_id = uuid::Uuid::new_v4().to_string();
    let _ = fs::write(id_file, &new_id);
    new_id
}

#[tauri::command]
fn get_machine_id_cmd(app: tauri::AppHandle) -> String {
    get_machine_id(&app)
}

fn report_active(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let machine_id = get_machine_id(&app);
        let os_info = os_info::get();
        let os_type = std::env::consts::OS.to_string();
        let os_version = os_info.version().to_string();
        let arch = std::env::consts::ARCH.to_string();
        let app_version = app.package_info().version.to_string();

        let payload = ClientInstallReportDto {
            machine_id,
            os_type,
            os_version,
            arch,
            app_version,
            user_id: None,
        };

        // 区分开发环境和生产环境的 API 地址
        #[cfg(debug_assertions)]
        let api_url = "http://127.0.0.1:8098/api/public/install/report";
        
        #[cfg(not(debug_assertions))]
        let api_url = "https://epet.flashcardfox.cn/api/public/install/report";

        let client = reqwest::Client::new();
        
        // 循环心跳上报 (启动时上报一次，然后每 4 小时上报一次)
        loop {
            println!("开始上报装机状态到: {}", api_url);
            match client.post(api_url)
                .json(&payload)
                .send()
                .await {
                Ok(response) => {
                    if response.status().is_success() {
                        println!("装机状态上报成功!");
                    } else {
                        println!("装机状态上报失败，HTTP状态码: {}", response.status());
                    }
                },
                Err(e) => {
                    println!("装机状态上报请求异常: {}", e);
                }
            }
            
            // 每 4 小时 (14400秒) 心跳一次
            tokio::time::sleep(std::time::Duration::from_secs(14400)).await;
        }
    });
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => {
            println!("发现新版本: {}", update.version);

            let message = format!(
                "发现新版本 {}，是否立即更新？\n\n更新说明:\n{}",
                update.version,
                update.body.clone().unwrap_or_default()
            );

            // 使用 dialog 插件询问用户
            let app_clone = app.clone();
            app.dialog()
                .message(message)
                .title("发现新版本")
                .buttons(MessageDialogButtons::OkCancelCustom("更新".to_string(), "稍后".to_string()))
                .show(move |result| {
                    if result {
                        tauri::async_runtime::spawn(async move {
                            println!("用户同意更新，开始下载...");

                            #[cfg(target_os = "macos")]
                            {
                                if let Ok(exe_path) = std::env::current_exe() {
                                    let path_str = exe_path.to_string_lossy();
                                    if path_str.contains("AppTranslocation") || path_str.starts_with("/Volumes/") {
                                        println!("检测到在 DMG 或隔离区运行，拦截更新");
                                        let _ = app_clone.dialog()
                                            .message("检测到应用正在隔离区或安装包中运行，无法直接进行自动更新。\n\n请先将应用拖入「应用程序 (Applications)」文件夹后再试。")
                                            .title("更新受限")
                                            .kind(tauri_plugin_dialog::MessageDialogKind::Warning)
                                            .show(|_| {});
                                        return;
                                    }
                                }
                            }

                            let mut downloaded = 0;
                            if let Err(e) = update.download_and_install(
                                |chunk_length, content_length| {
                                    downloaded += chunk_length;
                                    println!("下载进度: {}/{}", downloaded, content_length.unwrap_or(0));
                                },
                                || {
                                    println!("下载完成");
                                },
                            ).await {
                                println!("更新失败: {}", e);
                                let _ = app_clone.dialog()
                                    .message(format!("更新失败: {}", e))
                                    .title("更新失败")
                                    .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                                    .show(|_| {});
                            } else {
                                println!("更新成功，准备重启...");
                                app_clone.restart();
                            }
                        });
                    } else {
                        println!("用户取消了更新");
                    }
                });
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
        summon_win
            .eval(&format!("window.dispatchSummonEvent('{}')", payload))
            .ok();
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
            floating_win
                .set_position(PhysicalPosition::new(x, y))
                .unwrap();
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
    let mock_payload =
        r#"[{\"studentName\":\"测试学生张三\",\"message\":\"请立即到办公室一趟！\"}]"#;
    if let Some(summon_win) = app.get_webview_window("summon") {
        summon_win
            .eval(&format!("window.dispatchSummonEvent('{}')", mock_payload))
            .ok();
        summon_win.show().unwrap();
        summon_win.set_always_on_top(true).unwrap();
        summon_win.set_focus().unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![trigger_summon, test_summon, hide_main_show_floating, restore_main, hide_summon, check_for_updates, get_machine_id_cmd])
        .setup(|app| {
            // 上报装机活跃状态
            report_active(app.handle().clone());

            // 在应用启动时立刻检测 macOS 隔离区
            #[cfg(target_os = "macos")]
            {
                if let Ok(exe_path) = std::env::current_exe() {
                    let path_str = exe_path.to_string_lossy();
                    if path_str.contains("AppTranslocation") || path_str.starts_with("/Volumes/") {
                        let _ = app.handle().dialog()
                            .message("检测到应用正在「下载」文件夹或安装包中直接运行。\n\n为了保证自动更新和数据存储的正常使用，请将应用拖入「应用程序 (Applications)」文件夹后再运行。")
                            .title("建议移动到应用程序")
                            .kind(tauri_plugin_dialog::MessageDialogKind::Warning)
                            .show(|_| {
                                std::process::Command::new("open")
                                    .arg("/Applications")
                                    .spawn()
                                    .ok();
                            });
                    }
                }
            }

            let _main_window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("https://flashcardfox.cn/".parse().unwrap())
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
                            window.__TAURI_INTERNALS__.invoke('check_for_updates').catch(err => {
                                console.log("检查更新失败 (可能是本地开发环境未打签名包): ", err);
                            });
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
            .shadow(false)
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
            .shadow(false)
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
