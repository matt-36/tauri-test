/// Functions used to call core app functions (tauri invokes)

/**
 * 
 */
export function openProxyWindow() {
    let win = window.__TAURI__.window.WebviewWindow.getByLabel('proxies');
    win.show()
}
/**
 * 
 */
export function openTokenWindow() {
    let win = window.__TAURI__.window.WebviewWindow.getByLabel('tokens');
    win.show()
}

/**
 * @description joins all tokens to the server 
 */
export function joinServer(code) {
    window.__TAURI__.invoke('join_server', {link: code})
}

/**
 * @description updates the raid state to stop or continue raiding
 */
export function updateRaidState(state) {
    window.__TAURI__.invoke('update_raid_state', {state: state})
}