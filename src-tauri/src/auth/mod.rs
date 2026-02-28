pub mod config;

use crate::commands::AppState;
use crate::models::UserInfo;
use anyhow::Result;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// Generate PKCE code verifier (43-128 chars of unreserved URI chars)
fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

/// Derive code challenge from verifier using S256
fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    URL_SAFE_NO_PAD.encode(result)
}

/// Generate random state for CSRF protection
fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

/// Start a temporary HTTP server on localhost to receive the OAuth callback.
/// Returns (port, server) so we can extract the code.
fn start_callback_server() -> Result<(u16, tiny_http::Server)> {
    // Try to bind on a random port
    let server =
        tiny_http::Server::http("127.0.0.1:0").map_err(|e| anyhow::anyhow!("{}", e))?;
    let port = server.server_addr().to_ip().unwrap().port();
    Ok((port, server))
}

/// Wait for the OAuth callback on the temporary server.
/// Returns the authorization code and state from the query string.
fn wait_for_callback(server: tiny_http::Server) -> Result<(String, String)> {
    // Wait for one request (with a timeout via the server's default)
    let request = server
        .recv()
        .map_err(|e| anyhow::anyhow!("Failed to receive callback: {}", e))?;

    let url = request.url().to_string();

    // Send a friendly HTML response to the user's browser
    let response_html = r#"<html><body style="font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0;">
        <div style="text-align: center;">
            <h1 style="color: #6366f1;">Signed in to RepoTrack</h1>
            <p>You can close this tab and return to the app.</p>
        </div>
    </body></html>"#;
    let response = tiny_http::Response::from_string(response_html)
        .with_header("Content-Type: text/html".parse::<tiny_http::Header>().unwrap());
    let _ = request.respond(response);

    // Parse query string from URL
    let query = url
        .split('?')
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("No query string in callback"))?;

    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        match (parts.next(), parts.next()) {
            (Some("code"), Some(v)) => code = Some(urlencoding::decode(v)?.into_owned()),
            (Some("state"), Some(v)) => state = Some(urlencoding::decode(v)?.into_owned()),
            _ => {}
        }
    }

    let code = code.ok_or_else(|| anyhow::anyhow!("No code in callback"))?;
    let state = state.ok_or_else(|| anyhow::anyhow!("No state in callback"))?;

    Ok((code, state))
}

/// Exchange authorization code for tokens with GitHub
async fn exchange_github_token(code: &str, code_verifier: &str, redirect_uri: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(config::GITHUB_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", config::GITHUB_CLIENT_ID),
            ("client_secret", config::GITHUB_CLIENT_SECRET),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    json["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            let err = json["error_description"]
                .as_str()
                .unwrap_or("Unknown error");
            anyhow::anyhow!("GitHub token exchange failed: {}", err)
        })
}

/// Exchange authorization code for tokens with Google
async fn exchange_google_token(code: &str, code_verifier: &str, redirect_uri: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(config::GOOGLE_TOKEN_URL)
        .form(&[
            ("client_id", config::GOOGLE_CLIENT_ID),
            ("client_secret", config::GOOGLE_CLIENT_SECRET),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", code_verifier),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    json["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            let err = json["error_description"]
                .as_str()
                .unwrap_or("Unknown error");
            anyhow::anyhow!("Google token exchange failed: {}", err)
        })
}

/// Fetch GitHub user profile
async fn fetch_github_user(access_token: &str) -> Result<UserInfo> {
    let client = reqwest::Client::new();
    let resp = client
        .get(config::GITHUB_USER_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "RepoTrack")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    Ok(UserInfo {
        display_name: json["name"]
            .as_str()
            .or_else(|| json["login"].as_str())
            .unwrap_or("GitHub User")
            .to_string(),
        username: json["login"]
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        provider: "github".to_string(),
        avatar_url: json["avatar_url"].as_str().map(|s| s.to_string()),
    })
}

/// Fetch Google user profile
async fn fetch_google_user(access_token: &str) -> Result<UserInfo> {
    let client = reqwest::Client::new();
    let resp = client
        .get(config::GOOGLE_USERINFO_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    Ok(UserInfo {
        display_name: json["name"]
            .as_str()
            .unwrap_or("Google User")
            .to_string(),
        username: json["sub"]
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        provider: "google".to_string(),
        avatar_url: json["picture"].as_str().map(|s| s.to_string()),
    })
}

#[tauri::command]
pub async fn sign_in(
    provider: String,
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<UserInfo> {
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let csrf_state = generate_state();

    // Start callback server
    let (port, server) = start_callback_server().map_err(map_err)?;
    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);

    // Build authorization URL
    let auth_url = match provider.as_str() {
        "github" => format!(
            "{}?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            config::GITHUB_AUTH_URL,
            config::GITHUB_CLIENT_ID,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(config::GITHUB_SCOPES),
            &csrf_state,
            &code_challenge,
        ),
        "google" => format!(
            "{}?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256&response_type=code&access_type=offline",
            config::GOOGLE_AUTH_URL,
            config::GOOGLE_CLIENT_ID,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(config::GOOGLE_SCOPES),
            &csrf_state,
            &code_challenge,
        ),
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    // Open browser
    tauri::async_runtime::spawn_blocking({
        let auth_url = auth_url.clone();
        move || {
            let _ = open::that(&auth_url);
        }
    })
    .await
    .map_err(map_err)?;

    // Wait for callback in a blocking thread
    let (code, returned_state) = tauri::async_runtime::spawn_blocking(move || {
        wait_for_callback(server)
    })
    .await
    .map_err(map_err)?
    .map_err(map_err)?;

    // Verify CSRF state
    if returned_state != csrf_state {
        return Err("OAuth state mismatch — possible CSRF attack".to_string());
    }

    // Exchange code for token and fetch profile
    let (access_token, user_info) = match provider.as_str() {
        "github" => {
            let token = exchange_github_token(&code, &code_verifier, &redirect_uri)
                .await
                .map_err(map_err)?;
            let user = fetch_github_user(&token).await.map_err(map_err)?;
            (token, user)
        }
        "google" => {
            let token = exchange_google_token(&code, &code_verifier, &redirect_uri)
                .await
                .map_err(map_err)?;
            let user = fetch_google_user(&token).await.map_err(map_err)?;
            (token, user)
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    // Store in DB
    state
        .db
        .save_auth_token(
            &provider,
            &access_token,
            None,
            None,
            &user_info.display_name,
            &user_info.username,
            user_info.avatar_url.as_deref(),
        )
        .map_err(map_err)?;

    // Update current_user in AppState
    {
        let mut current = state.current_user.lock().map_err(map_err)?;
        *current = Some(user_info.clone());
    }

    Ok(user_info)
}

#[tauri::command]
pub fn sign_out(provider: String, state: State<AppState>) -> CmdResult<()> {
    state.db.remove_auth_token(&provider).map_err(map_err)?;

    // Clear current_user if it was this provider
    let mut current = state.current_user.lock().map_err(map_err)?;
    if current
        .as_ref()
        .map(|u| u.provider == provider)
        .unwrap_or(false)
    {
        *current = None;
    }
    Ok(())
}

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> CmdResult<Option<UserInfo>> {
    let current = state.current_user.lock().map_err(map_err)?;
    Ok(current.clone())
}
