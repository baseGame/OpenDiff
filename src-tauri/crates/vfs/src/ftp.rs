//! FTP VFS backend — connects to any FTP/FTPS server.
//!
//! Requires: `features = ["ftp"]` in Cargo.toml.
//!
//! Connection URL format:
//! `ftp://user:pass@host:port/path`

use crate::{Vfs, VfsError, VfsKind, Entry, EntryKind, Metadata, VPath};
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct FtpVfs {
    host: String,
    port: u16,
    user: String,
    password: String,
    base_path: Option<VPath>,
    use_tls: bool,
}

impl FtpVfs {
    pub fn from_url(url_str: &str) -> Result<Self, VfsError> {
        let u = url::Url::parse(url_str)
            .map_err(|e| VfsError::InvalidPath(url_str.into(), e.to_string()))?;

        let scheme = u.scheme();
        if scheme != "ftp" && scheme != "ftps" && scheme != "ftpes" {
            return Err(VfsError::InvalidPath(url_str.into(), format!("expected ftp/ftps scheme, got {scheme}").into()));
        }

        let host = u.host_str()
            .ok_or_else(|| VfsError::InvalidPath(url_str.into(), "missing host".into()))?;
        let port = u.port().unwrap_or(21);
        let user = if u.username().is_empty() { "anonymous".into() } else { u.username().to_string() };
        let password = u.password().unwrap_or("anonymous@").to_string();
        let base_path = u.path().strip_prefix('/').filter(|p| !p.is_empty()).map(|p| VPath::new(p));

        Ok(Self {
            host: host.into(),
            port,
            user,
            password,
            base_path,
            use_tls: scheme == "ftps" || scheme == "ftpes",
        })
    }

    fn full_path(&self, path: &VPath) -> String {
        let p = path.as_str().trim_start_matches('/');
        match &self.base_path {
            Some(base) => format!("{}/{}", base.as_str().trim_end_matches('/'), p),
            None => p.to_string(),
        }
    }
}

#[cfg(feature = "ftp")]
mod ftp_impl {
    use super::*;
    use suppaftp::{FtpStream, NativeTlsFtpStream};
    use std::sync::Mutex;

    pub struct FtpVfsInner {
        pub host: String,
        pub port: u16,
        pub user: String,
        pub password: String,
        pub base_path: Option<VPath>,
        pub use_tls: bool,
        pool: std::sync::Mutex<FtpStream>,
    }

    impl FtpVfsInner {
        pub fn from_url(url_str: &str) -> Result<Self, VfsError> {
            let this = Self::_from_url(url_str)?;
            let stream = this._connect()?;
            Ok(Self { pool: std::sync::Mutex::new(stream), ..this })
        }

        fn _from_url(url_str: &str) -> Result<Self, VfsError> {
            let u = url::Url::parse(url_str)
                .map_err(|e| VfsError::InvalidPath(url_str.into(), e.to_string()))?;
            let host = u.host_str().ok_or_else(|| VfsError::InvalidPath(url_str.into(), "missing host".into()))?;
            let port = u.port().unwrap_or(21);
            let user = if u.username().is_empty() { "anonymous".into() } else { u.username().to_string() };
            let password = u.password().unwrap_or("anonymous@").to_string();
            let base_path = u.path().strip_prefix('/').filter(|p| !p.is_empty()).map(|p| VPath::new(p));
            let scheme = u.scheme();
            Ok(Self {
                host: host.into(), port, user, password, base_path,
                use_tls: scheme == "ftps" || scheme == "ftpes",
                pool: std::sync::Mutex::new(unsafe { std::mem::zeroed() }), // placeholder
            })
        }

        fn _connect(&self) -> Result<FtpStream, VfsError> {
            let stream = FtpStream::connect(format!("{}:{}", self.host, self.port))
                .map_err(|e| VfsError::Other(format!("FTP connect: {e}")))?;
            if self.use_tls {
                let stream = stream.into_secure(
                    native_tls::TlsConnector::new().map_err(|e| VfsError::Other(format!("TLS: {e}")))?,
                    &self.host,
                ).map_err(|e| VfsError::Other(format!("FTP TLS: {e}")))?;
                Ok(stream)
            } else {
                Ok(stream)
            }
        }

        fn with_conn<F, T>(&self, f: F) -> Result<T, VfsError>
        where F: FnOnce(&mut FtpStream) -> Result<T, suppaftp::FtpError> {
            let mut stream = self.pool.lock().map_err(|e| VfsError::Other(e.to_string()))?;
            // Try to reuse existing connection
            let result = f(&mut stream);
            match result {
                Ok(r) => Ok(r),
                Err(_) => {
                    // Reconnect and retry
                    drop(stream);
                    let mut new_stream = self._connect()?;
                    let r = f(&mut new_stream)?;
                    stream = new_stream;
                    Ok(r)
                }
            }
        }

        fn full_path(&self, path: &VPath) -> String {
            let p = path.as_str().trim_start_matches('/');
            match &self.base_path {
                Some(base) => format!("{}/{}", base.as_str().trim_end_matches('/'), p),
                None => p.to_string(),
            }
        }
    }

    #[async_trait]
    impl Vfs for FtpVfsInner {
        async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError> {
            use suppaftp::FtpResponse;
            let dir_path = self.full_path(path);
            // Synchronous call in async context — ok for FTP since it's I/O bound
            let resp = self.with_conn(|s| s.nlst(Some(&dir_path)))?;
            let listing = resp.into_body();
            let lines: Vec<&str> = listing.lines().collect();

            let mut entries = Vec::new();
            for line in lines {
                let name = std::path::Path::new(line)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(line)
                    .to_string();
                // Try to stat each entry (FTP LIST doesn't include size consistently)
                entries.push(Entry {
                    path: VPath::new(line),
                    name,
                    kind: EntryKind::File, // heuristic; directories not reliably detected
                    metadata: Metadata {
                        size: None, modified: None, created: None,
                        is_dir: false, is_symlink: false, readonly: false, permissions: None,
                    },
                });
            }
            Ok(entries)
        }

        async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError> {
            use std::time::{SystemTime, UNIX_EPOCH};
            let full = self.full_path(path);
            self.with_conn(|s| s.size(&full))
                .map(|size| Metadata {
                    size: Some(size),
                    modified: Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64),
                    created: None, is_dir: false, is_symlink: false, readonly: false, permissions: None,
                })
                .map_err(|e| VfsError::Other(format!("FTP stat: {e}")))
        }

        async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError> {
            use suppaftp::FtpStream;
            let full = self.full_path(path);
            let bytes = self.with_conn(|s| {
                let mut reader = s.get(&full)?;
                let mut buf = Vec::new();
                std::io::Read::read_to_string(&mut reader, &mut buf)?;
                Ok(buf.into_bytes())
            }).map_err(|e| VfsError::Other(format!("FTP read: {e}")))?;
            Ok(bytes)
        }

        async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError> {
            use std::io::Write;
            let full = self.full_path(path);
            self.with_conn(|s| {
                let mut writer = s.put_file(&full, suppaftp::Type::Binary)?;
                writer.write_all(data)?;
                writer.finalize()?;
                Ok(())
            }).map_err(|e| VfsError::Other(format!("FTP write: {e}")))
        }

        async fn mkdir(&self, path: &VPath) -> Result<(), VfsError> {
            let full = self.full_path(path);
            self.with_conn(|s| s.mkdir(&full, true))
                .map_err(|e| VfsError::Other(format!("FTP mkdir: {e}")))
        }

        async fn delete(&self, path: &VPath, _recursive: bool) -> Result<(), VfsError> {
            let full = self.full_path(path);
            self.with_conn(|s| s.rm(&full))
                .map_err(|e| VfsError::Other(format!("FTP delete: {e}")))
        }

        async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError> {
            self.with_conn(|s| s.rename(&self.full_path(src), &self.full_path(dst)))
                .map_err(|e| VfsError::Other(format!("FTP rename: {e}")))
        }

        fn kind(&self) -> VfsKind { VfsKind::Ftp }
    }
}

#[cfg(feature = "ftp")]
pub use ftp_impl::FtpVfsInner as FtpVfs;

#[cfg(not(feature = "ftp"))]
impl Vfs for FtpVfs {
    fn kind(&self) -> VfsKind { VfsKind::Ftp }
    async fn list(&self, _: &VPath) -> Result<Vec<Entry>, VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn stat(&self, _: &VPath) -> Result<Metadata, VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn read_all(&self, _: &VPath) -> Result<Vec<u8>, VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn write(&self, _: &VPath, _: &[u8]) -> Result<(), VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn mkdir(&self, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn delete(&self, _: &VPath, _: bool) -> Result<(), VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
    async fn rename(&self, _: &VPath, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
}

#[cfg(not(feature = "ftp"))]
impl FtpVfs {
    pub fn from_url(_url: &str) -> Result<Self, VfsError> {
        Err(VfsError::Other("FTP support requires `features = [\"ftp\"]` in Cargo.toml".into()))
    }
}
