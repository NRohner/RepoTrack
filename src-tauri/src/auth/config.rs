// OAuth client configuration
// Register your own apps at:
//   GitHub: https://github.com/settings/developers
//   Google: https://console.cloud.google.com/apis/credentials

pub const GITHUB_CLIENT_ID: &str = "Ov23limx4ycBsoTJRKsP";
// Set GITHUB_CLIENT_SECRET env var before building (or in .env file)
pub const GITHUB_CLIENT_SECRET: &str = env!("GITHUB_CLIENT_SECRET");
pub const GITHUB_AUTH_URL: &str = "https://github.com/login/oauth/authorize";
pub const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
pub const GITHUB_USER_URL: &str = "https://api.github.com/user";
pub const GITHUB_SCOPES: &str = "read:user";

pub const GOOGLE_CLIENT_ID: &str =
    "915344776664-c2tma0p1vmp1ru6qfra8qkqnbm16pitr.apps.googleusercontent.com";
pub const GOOGLE_CLIENT_SECRET: &str = env!("GOOGLE_CLIENT_SECRET");
pub const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
pub const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
pub const GOOGLE_USERINFO_URL: &str = "https://openidconnect.googleapis.com/v1/userinfo";
pub const GOOGLE_SCOPES: &str = "openid profile";
