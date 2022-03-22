use std::{io::{Write, Read}, fs::File};

use tauri::Error;

extern crate tauri;

mod preloader;
mod ui;
pub mod commands;

fn main() {
    preloader::main();
    ui::main();
}
