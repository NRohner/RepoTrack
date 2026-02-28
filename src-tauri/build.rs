fn main() {
    // Load .env file from project root so env!() can read secrets at compile time
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join(".env");
    if env_path.exists() {
        for line in std::fs::read_to_string(&env_path).unwrap().lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                println!("cargo:rustc-env={}={}", key.trim(), value.trim());
            }
        }
        println!("cargo:rerun-if-changed={}", env_path.display());
    }

    tauri_build::build()
}
