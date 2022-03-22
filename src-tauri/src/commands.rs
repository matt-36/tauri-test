use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    thread,
};

use reqwest::{Client, ClientBuilder, Proxy};
use serde_json::{json, Value};
use tauri::State;

pub struct RaidState {
    message: String,
    accountstate: AccountState,
    msg_delay: i32,
    channel_id: u64
}
pub struct AccountState {
    accounts: Vec<Account>,
}
struct Account {
    token: String,
    client: Client,
}

impl Account {
    fn send(&self, content: String, channel_id: u64) {
        let req = self
            .client
            .post("https://discord.com/api/v9/channels/{channel_id}/messages")
            .header(reqwest::header::AUTHORIZATION, &self.token)
            .json(&json!({ "content": content }))
            .send();
        todo!()
    }
    fn join(&self, code: String) {
        let req = self
            .client
            .request(
                reqwest::Method::POST,
                "https://discord.com/api/v9/invites/{code}",
            )
            .header(reqwest::header::AUTHORIZATION, &self.token)
            .json(&json!({}))
            .send();
    }
}

fn create_account_instance(proxy: Option<String>, token: String) -> Account {
    if !proxy.is_none() {
        Account {
            token,
            client: ClientBuilder::new()
                .proxy(Proxy::http(format!("http://{}", proxy.unwrap())).unwrap())
                .build()
                .unwrap(),
        }
    } else {
        Account {
            token,
            client: ClientBuilder::new().build().unwrap(),
        }
    }
}

fn init_accounts() -> Vec<Account> {
    let mut ret: Vec<Account> = Vec::new();
    let tokenstr = get_tokens();
    let proxystr = get_proxies();
    let tokens: Vec<&str> = tokenstr.split("\n").collect();
    let proxies: Vec<&str> = proxystr.split("\n").collect();
    if proxies.is_empty() {
        for token in &tokens {
            ret.push(create_account_instance(None, token.to_string()));
        }
    }
    let mut i = 0;
    for token in &tokens {
        if i == proxies.len() - 1 {
            i = 0
        }
        ret.push(create_account_instance(
            Some(proxies[i].to_string()),
            token.to_string(),
        ));
        i += 1;
    }

    ret
}

#[tauri::command]
pub fn set_tokens(tokens: String) {
    if let Ok(mut file) = File::create("tokens.txt") {
        file.write(tokens.as_bytes()).unwrap();
    }
}

#[tauri::command]
pub fn set_proxies(proxies: String) {
    if let Ok(mut file) = File::create("proxies.txt") {
        file.write(proxies.as_bytes()).unwrap();
    }
}

#[tauri::command]
pub fn get_tokens() -> String {
    if let Ok(mut file) = File::open("tokens.txt") {
        let mut content = String::new();
        file.read_to_string(&mut content).unwrap();
        return content.to_string();
    } else {
        "Failed to read file".to_string()
    }
}

#[tauri::command]
pub fn get_proxies() -> String {
    if let Ok(mut file) = File::open("proxies.txt") {
        let mut content = String::new();
        file.read_to_string(&mut content);
        content.to_string()
    } else {
        "Failed to read file ".to_string()
    }
}

#[tauri::command]
pub fn join_server(code: String, state: State<RaidState>) -> Result<String, String> {
    for account in &state.accountstate.accounts {
        account.join(code.clone());
    }
    Ok("Joined server {code}".to_string())
}

pub fn update_message(message: String, state: State<RaidState>) {
    state.message = message;
}

pub fn spam(state: State<RaidState>) {
    tauri::async_runtime::spawn(move || 'spamming: loop {
        for account in state.accountstate.accounts {
            account.send(state.message.clone(), state.channel_id);
            thread::sleep(state.msg_delay)
        }
    });
}
