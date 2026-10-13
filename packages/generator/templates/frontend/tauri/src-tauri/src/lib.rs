/// Commande appelée par l'interface (`invoke('greet', { name })`).
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Bonjour, {name} ! Ce message vient de Rust.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de l'application Tauri");
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_cite_le_nom() {
        assert!(greet("Ada").contains("Ada"));
    }
}
