use std::{thread::sleep, time::Duration};
use tauri::Manager;
use super::commands::*;


// this command is here just so the example doesn't throw an error
#[tauri::command]
fn close_splashscreen() {}

pub fn main() {
    tauri::Builder::default()
      .setup(|app| {
        let splashscreen_window = app.get_window("preloader").unwrap();
        let main_window = app.get_window("main").unwrap();
        // we perform the initialization code on a new task so the app doesn't crash
        tauri::async_runtime::spawn(async move {
          println!("Initializing...");
          
          sleep(Duration::from_secs(2));
          println!("Done initializing.");

          // After it's done, close the splashscreen and display the main window
          splashscreen_window.close().unwrap();
          main_window.show().unwrap();
        });
        Ok(())
      })
      .invoke_handler(tauri::generate_handler![close_splashscreen, get_proxies, set_proxies, get_tokens, set_tokens, join_server])
      .manage(TrueState::new())
      .run(tauri::generate_context!(
        "tauri.conf.json"
      ))
      .expect("failed to run app");
}