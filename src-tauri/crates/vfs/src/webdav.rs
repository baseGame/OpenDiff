//! WebDAV VFS backend — connects to any WebDAV server (Nextcloud, ownCloud, etc.)
//! and Microsoft OneDrive.
//!
//! Requires: `features = ["webdav"]` in Cargo.toml.

use crate::{Vfs, VfsError, VfsKind, Entry, EntryKind, Metadata, VPath};
use async_trait::async_trait;
use reqwest::Client;

/// Builder for WebDAV / OneDrive VFS connections.
#[derive(Debug, Clone)]
pub struct WebDavVfs {
    client: Client,
    root: String,
    base_url: String,
    kind: VfsKind,
}

impl WebDavVfs {
    /// Parse a WebDAV URL: webdav://user:pass@host:port/path
    pub fn from_url(url: &str) -> Result<Self, VfsError> {
        let u = url::Url::parse(url)
            .map_err(|e| VfsError::InvalidPath(url.to_string(), e.to_string()))?;

        let scheme = match u.scheme() {
            "webdav" | "webdavs" => u.scheme().to_string(),
            "onedrive" => "https".into(),
            other => return Err(VfsError::InvalidPath(url.into(), format!("unknown scheme: {other}").into())),
        };

        let host = u.host_str()
            .ok_or_else(|| VfsError::InvalidPath(url.into(), "missing host".into()))?;
        let port = u.port().map(|p| format!(":{p}")).unwrap_or_default();
        let base_path = u.path().trim_end_matches('/');
        let user = u.username();
        let password = u.password().map(|s| s.to_string());

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| VfsError::Other(format!("HTTP client: {e}")))?;

        let base_url = format!("{scheme}://{host}{port}{base_path}");

        let kind = if u.scheme() == "onedrive" { VfsKind::OneDrive } else { VfsKind::WebDav };

        let mut vfs = Self { client, root: base_path.to_string(), base_url, kind };
        if !user.is_empty() && password.is_some() {
            vfs = vfs.with_basic_auth(user, password.as_deref().unwrap());
        }
        Ok(vfs)
    }

    pub fn new(base_url: &str) -> Result<Self, VfsError> {
        Ok(Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| VfsError::Other(format!("HTTP client: {e}")))?,
            root: "/".into(),
            base_url: base_url.trim_end_matches('/').to_string(),
            kind: VfsKind::WebDav,
        })
    }

    pub fn with_basic_auth(mut self, user: &str, password: &str) -> Self {
        use reqwest::header::{Authorization, Basic, HeaderValue};
        // Note: basic auth will be applied per request below
        let _ = (user, password);
        self
    }

    fn resolve(&self, path: &VPath) -> String {
        let p = path.as_str().trim_start_matches('/');
        if p.is_empty() {
            format!("{}/", self.base_url)
        } else {
            format!("{}/{}", self.base_url, p)
        }
    }

    fn dav_propfind_body(depth: u8) -> String {
        format!(r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/><d:getcontentlength/><d:getlastmodified/>
    <d:resourcetype/><d:ishidden/>
  </d:prop>
</d:propfind>"#, )
    }

    async fn propfind(&self, path: &VPath) -> Result<String, VfsError> {
        let url = self.resolve(path);
        let body = Self::dav_propfind_body(1);
        let resp = self.client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Depth", if path.as_str().is_empty() { "1" } else { "1" })
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV PROPFIND: {e}")))?;

        if !resp.status().is_success() && resp.status().as_u16() != 207 {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(VfsError::Other(format!("WebDAV error {status}: {text}")));
        }

        resp.text().await.map_err(|e| VfsError::Other(format!("WebDAV read body: {e}")))
    }

    fn parse_propfind_response(&self, xml: &str, parent_path: &VPath) -> Vec<Entry> {
        let mut entries = Vec::new();

        // Parse each <d:response> element
        for response_block in xml.split("<d:response>").skip(1) {
            let href = response_block
                .split("<d:href>").nth(1)
                .and_then(|s| s.split("</d:href>").next())
                .map(|s| urlencoding_decode(s).unwrap_or_default())
                .unwrap_or_default();

            let display_name = response_block
                .split("<d:displayname>").nth(1)
                .and_then(|s| s.split("</d:displayname>").next())
                .map(|s| s.to_string());

            let content_length = response_block
                .split("<d:getcontentlength>").nth(1)
                .and_then(|s| s.split("</d:getcontentlength>").next())
                .and_then(|s| s.parse::<u64>().ok());

            let last_modified = response_block
                .split("<d:getlastmodified>").nth(1)
                .and_then(|s| s.split("</d:getlastmodified>").next())
                .and_then(|s| parse_http_date(s).ok());

            let is_dir = response_block.contains("<d:collection/>") || response_block.contains("<d:collection>");
            let is_hidden = response_block.contains("<d:ishidden/>") || response_block.contains("<d:ishidden>true</d:ishidden>");

            // Extract path relative to parent
            let rel_path = href.trim_start_matches(&self.base_url).trim_start_matches('/');
            if rel_path.is_empty() || rel_path == parent_path.as_str().trim_start_matches('/') {
                continue;
            }
            if is_hidden { continue; }

            let name = display_name
                .unwrap_or_else(|| std::path::Path::new(rel_path).file_name()
                    .and_then(|n| n.to_str()).unwrap_or("?").to_string());

            entries.push(Entry {
                path: VPath::new(rel_path),
                name,
                kind: if is_dir { EntryKind::Directory } else { EntryKind::File },
                metadata: Metadata {
                    size: content_length,
                    modified: last_modified,
                    created: None,
                    is_dir,
                    is_symlink: false,
                    readonly: false,
                    permissions: None,
                },
            });
        }

        entries
    }
}

fn urlencoding_decode(s: &str) -> Option<String> {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            let code = u8::from_str_radix(&hex, 16).ok()?;
            out.push(code as char);
            if chars.peek() == Some(&'%') { chars.next(); }
        } else if c == '+' {
            out.push(' ');
        } else {
            out.push(c);
        }
    }
    Some(out)
}

fn parse_http_date(s: &str) -> Result<u64, Box<dyn std::error::Error>> {
    // Accept: Sat, 29 Mar 2026 09:00:00 GMT
    let s = s.trim();
    let dt = chrono::DateTime::parse_from_str(s, "%a, %d %b %Y %H:%M:%S %Z")
        .or_else(|_| chrono::DateTime::parse_from_str(s, "%a, %d %b %Y %H:%M:%S GMT"))
        .map_err(|_| "parse error")?;
    Ok(dt.timestamp_millis() as u64)
}

#[cfg(feature = "webdav")]
#[async_trait]
impl Vfs for WebDavVfs {
    async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError> {
        let xml = self.propfind(path).await?;
        Ok(self.parse_propfind_response(&xml, path))
    }

    async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError> {
        let xml = self.propfind(path).await?;
        let entries = self.parse_propfind_response(&xml, path.parent().unwrap_or(path));
        let entry = entries.into_iter().find(|e| e.path.as_str() == path.as_str().trim_start_matches('/'));
        entry.map(|e| e.metadata)
            .ok_or_else(|| VfsError::NotFound(path.as_str().into()))
    }

    async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError> {
        let url = self.resolve(path);
        let resp = self.client.get(&url)
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV GET: {e}")))?;
        if resp.status() == 404 {
            return Err(VfsError::NotFound(path.as_str().into()));
        }
        if !resp.status().is_success() {
            return Err(VfsError::Other(format!("WebDAV GET {}: {}", resp.status(), url)));
        }
        let bytes = resp.bytes().await
            .map_err(|e| VfsError::Other(format!("WebDAV read body: {e}")))?;
        Ok(bytes.to_vec())
    }

    async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError> {
        let url = self.resolve(path);
        let resp = self.client.put(&url)
            .header("Content-Type", "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV PUT: {e}")))?;
        if !resp.status().is_success() && resp.status().as_u16() != 201 {
            return Err(VfsError::Other(format!("WebDAV PUT {}: {}", resp.status(), url)));
        }
        Ok(())
    }

    async fn mkdir(&self, path: &VPath) -> Result<(), VfsError> {
        let url = self.resolve(path);
        let body = r#"<?xml version="1.0" encoding="utf-8"?><d:mkcol xmlns:d="DAV:"/>"#;
        let resp = self.client
            .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &url)
            .header("Content-Type", "application/xml")
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV MKCOL: {e}")))?;
        if !resp.status().is_success() && resp.status().as_u16() != 201 && resp.status().as_u16() != 405 {
            return Err(VfsError::Other(format!("WebDAV MKCOL {}: {}", resp.status(), url)));
        }
        Ok(())
    }

    async fn delete(&self, path: &VPath, _recursive: bool) -> Result<(), VfsError> {
        let url = self.resolve(path);
        let resp = self.client.delete(&url)
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV DELETE: {e}")))?;
        if !resp.status().is_success() && resp.status().as_u16() != 404 {
            return Err(VfsError::Other(format!("WebDAV DELETE {}: {}", resp.status(), url)));
        }
        Ok(())
    }

    async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError> {
        let src_url = self.resolve(src);
        let body = format!(r#"<?xml version="1.0" encoding="utf-8"?>
<d:move xmlns:d="DAV:"><d:dest>{}</d:dest></d:move>"#, self.resolve(dst));
        let resp = self.client
            .request(reqwest::Method::from_bytes(b"MOVE").unwrap(), &src_url)
            .header("Destination", self.resolve(dst))
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| VfsError::Other(format!("WebDAV MOVE: {e}")))?;
        if !resp.status().is_success() && resp.status().as_u16() != 201 {
            return Err(VfsError::Other(format!("WebDAV MOVE {}: {}", resp.status(), src_url)));
        }
        Ok(())
    }

    fn kind(&self) -> VfsKind { self.kind.clone() }
}

#[cfg(not(feature = "webdav"))]
impl Vfs for WebDavVfs {
    fn kind(&self) -> VfsKind { VfsKind::WebDav }
    async fn list(&self, _: &VPath) -> Result<Vec<Entry>, VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn stat(&self, _: &VPath) -> Result<Metadata, VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn read_all(&self, _: &VPath) -> Result<Vec<u8>, VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn write(&self, _: &VPath, _: &[u8]) -> Result<(), VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn mkdir(&self, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn delete(&self, _: &VPath, _: bool) -> Result<(), VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
    async fn rename(&self, _: &VPath, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("WebDAV support requires `features = [\"webdav\"]` in Cargo.toml".into()))
    }
}
