use anyhow::Result;
use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use crate::{models::*, db::init_db};
use std::path::Path;

pub struct SessionManager {
    pool: SqlitePool,
}

impl SessionManager {
    pub async fn new(data_dir: &Path) -> Result<Self> {
        let db_path = data_dir.join("opendiff.db");
        let pool = init_db(&db_path).await?;
        Ok(Self { pool })
    }

    pub async fn save_session(&self, session: &Session) -> Result<()> {
        let config = serde_json::to_string(&session.config)?;
        sqlx::query(
            "INSERT OR REPLACE INTO sessions
             (id, name, kind, left_path, right_path, base_path, config, created_at, updated_at, last_opened)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&session.id)
        .bind(&session.name)
        .bind(serde_json::to_string(&session.kind)?)
        .bind(&session.left_path)
        .bind(&session.right_path)
        .bind(&session.base_path)
        .bind(&config)
        .bind(session.created_at.to_rfc3339())
        .bind(session.updated_at.to_rfc3339())
        .bind(session.last_opened.map(|t| t.to_rfc3339()))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_recent(&self, limit: i64) -> Result<Vec<Session>> {
        let rows = sqlx::query_as::<_, SessionRow>(
            "SELECT * FROM sessions ORDER BY COALESCE(last_opened, updated_at) DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(Session::try_from).collect()
    }

    pub async fn get_session(&self, id: &str) -> Result<Option<Session>> {
        let row = sqlx::query_as::<_, SessionRow>(
            "SELECT * FROM sessions WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        row.map(Session::try_from).transpose()
    }

    pub async fn delete_session(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub fn new_session(kind: SessionKind, left: String, right: String) -> Session {
        let now = Utc::now();
        Session {
            id: Uuid::new_v4().to_string(),
            name: format!("{} vs {}", short_name(&left), short_name(&right)),
            kind,
            left_path: left,
            right_path: right,
            base_path: None,
            config: SessionConfig::default(),
            created_at: now,
            updated_at: now,
            last_opened: Some(now),
        }
    }

    pub async fn get_settings(&self) -> Result<AppSettings> {
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT value FROM settings WHERE key = 'app_settings'"
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|(v,)| serde_json::from_str(&v).unwrap_or_default())
            .unwrap_or_default())
    }

    pub async fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let v = serde_json::to_string(settings)?;
        sqlx::query(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)"
        )
        .bind(v)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

fn short_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

#[derive(sqlx::FromRow)]
struct SessionRow {
    id: String,
    name: String,
    kind: String,
    left_path: String,
    right_path: String,
    base_path: Option<String>,
    config: String,
    created_at: String,
    updated_at: String,
    last_opened: Option<String>,
}

impl TryFrom<SessionRow> for Session {
    type Error = anyhow::Error;
    fn try_from(r: SessionRow) -> Result<Self> {
        Ok(Session {
            id: r.id,
            name: r.name,
            kind: serde_json::from_str(&r.kind)?,
            left_path: r.left_path,
            right_path: r.right_path,
            base_path: r.base_path,
            config: serde_json::from_str(&r.config)?,
            created_at: r.created_at.parse()?,
            updated_at: r.updated_at.parse()?,
            last_opened: r.last_opened.map(|s| s.parse()).transpose()?,
        })
    }
}
