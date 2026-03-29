//! SFTP VFS backend — connects to any SSH/SFTP server.
//!
//! Requires: `features = ["sftp"]` in Cargo.toml.
//!
//! Connection string format:
//! `sftp://user:pass@host:port/path`
//! `sftp://user@key_path@host:port/path`

use crate::{Vfs, VfsError, VfsKind, Entry, EntryKind, Metadata, VPath, ByteStream};
use async_trait::async_trait;
use std::sync::Arc;

/// Builder for SFTP VFS connections.
#[derive(Debug, Clone)]
pub struct SftpVfs {
    config: SftpConfig,
}

#[derive(Debug, Clone)]
pub struct SftpConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub base_path: Option<VPath>,
}

impl SftpVfs {
    /// Parse a connection URL: sftp://user:pass@host:port/base/path
    pub fn from_url(url: &str) -> Result<Self, VfsError> {
        let u = url::Url::parse(url)
            .map_err(|e| VfsError::InvalidPath(url.to_string(), e.to_string()))?;

        if u.scheme() != "sftp" {
            return Err(VfsError::InvalidPath(url.to_string(), "expected scheme sftp://".into()));
        }

        let host = u.host_str().ok_or_else(|| VfsError::InvalidPath(url.into(), "missing host".into()))?;
        let port = u.port().unwrap_or(22);
        let user = u.username();
        let password = u.password().map(|s| s.to_string());
        let base_path = u.path().strip_prefix('/').map(|p| VPath::new(p)).filter(|p| !p.as_str().is_empty());

        Ok(Self::new(SftpConfig {
            host: host.to_string(),
            port,
            user: user.to_string(),
            password,
            key_path: None,
            base_path,
        }))
    }

    pub fn new(config: SftpConfig) -> Self {
        Self { config }
    }

    fn full_path(&self, path: &VPath) -> String {
        match &self.config.base_path {
            Some(base) => format!("{}/{}", base.as_str(), path.as_str()),
            None => path.as_str().to_string(),
        }
    }
}

#[cfg(feature = "sftp")]
impl Vfs for SftpVfs {
    async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;
        use std::io::Read;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect failed: {e}")))?;
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(10)))
            .map_err(|e| VfsError::Other(e.to_string()))?;

        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp.try_clone().map_err(|e| VfsError::Other(e.to_string()))?);
        sess.handshake().map_err(|e| VfsError::Other(format!("SFTP handshake: {e}")))?;

        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw)
                .map_err(|e| VfsError::Other(format!("SFTP auth: {e}")))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")),
                None)
                .map_err(|e| VfsError::Other(format!("SFTP pubkey auth: {e}")))?;
        }

        let sftp = sess.sftp().map_err(|e| VfsError::Other(format!("SFTP channel: {e}")))?;
        let dir_path = self.full_path(path);

        let mut entries = Vec::new();
        let mut dir = sftp.readdir(std::path::Path::new(&dir_path))
            .map_err(|e| VfsError::Other(format!("SFTP readdir: {e}")))?;

        for (p, stat) in dir.drain(..) {
            let name = p.file_name()
                .to_str()
                .unwrap_or("?")
                .to_string();
            let full: String = p.to_str().unwrap_or("").to_string();
            let entry_path = VPath::new(full.strip_prefix(&dir_path).unwrap_or(&full).trim_start_matches('/'));

            entries.push(Entry {
                path: entry_path.clone(),
                name,
                kind: if stat.is_dir() { EntryKind::Directory }
                      else if stat.is_symlink() { EntryKind::Symlink }
                      else if stat.is_file() { EntryKind::File }
                      else { EntryKind::Other },
                metadata: Metadata {
                    size: stat.size(),
                    modified: None,
                    created: None,
                    is_dir: stat.is_dir(),
                    is_symlink: stat.is_symlink(),
                    readonly: false,
                    permissions: stat.perm().ok(),
                },
            });
        }

        Ok(entries)
    }

    async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(10)))
            .map_err(|e| VfsError::Other(e.to_string()))?;

        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("SFTP handshake: {e}")))?;

        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw)
                .map_err(|e| VfsError::Other(format!("SFTP auth: {e}")))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")),
                None)
                .map_err(|e| VfsError::Other(format!("SFTP pubkey: {e}")))?;
        }

        let sftp = sess.sftp().map_err(|e| VfsError::Other(format!("SFTP channel: {e}")))?;
        let stat = sftp.stat(std::path::Path::new(&self.full_path(path)))
            .map_err(|e| VfsError::Other(format!("SFTP stat: {e}")))?;

        Ok(Metadata {
            size: stat.size(),
            modified: None,
            created: None,
            is_dir: stat.is_dir(),
            is_symlink: stat.is_symlink(),
            readonly: false,
            permissions: stat.perm().ok(),
        })
    }

    async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
            .map_err(|e| VfsError::Other(e.to_string()))?;

        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("SFTP handshake: {e}")))?;

        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw)
                .map_err(|e| VfsError::Other(format!("SFTP auth: {e}")))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")),
                None)
                .map_err(|e| VfsError::Other(format!("SFTP pubkey: {e}")))?;
        }

        let sftp = sess.sftp().map_err(|e| VfsError::Other(format!("SFTP channel: {e}")))?;
        let mut file = sftp.open(std::path::Path::new(&self.full_path(path)))
            .map_err(|e| VfsError::Other(format!("SFTP open: {e}")))?;

        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        loop {
            let n = file.read(&mut chunk).map_err(|e| VfsError::Other(format!("SFTP read: {e}")))?;
            if n == 0 { break }
            buf.extend_from_slice(&chunk[..n]);
        }

        Ok(buf)
    }

    async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        tcp.set_write_timeout(Some(std::time::Duration::from_secs(30)))
            .map_err(|e| VfsError::Other(e.to_string()))?;

        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("SFTP handshake: {e}")))?;

        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw)
                .map_err(|e| VfsError::Other(format!("SFTP auth: {e}")))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")),
                None)
                .map_err(|e| VfsError::Other(format!("SFTP pubkey: {e}")))?;
        }

        let sftp = sess.sftp().map_err(|e| VfsError::Other(format!("SFTP channel: {e}")))?;
        let mut file = sftp.create(std::path::Path::new(&self.full_path(path)))
            .map_err(|e| VfsError::Other(format!("SFTP create: {e}")))?;
        file.write_all(data).map_err(|e| VfsError::Other(format!("SFTP write: {e}")))?;
        Ok(())
    }

    async fn mkdir(&self, path: &VPath) -> Result<(), VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("handshake: {e}")))?;
        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw).map_err(|e| VfsError::Other(e.to_string()))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")), None)
                .map_err(|e| VfsError::Other(e.to_string()))?;
        }
        let sftp = sess.sftp().map_err(|e| VfsError::Other(e.to_string()))?;
        sftp.mkdir(std::path::Path::new(&self.full_path(path)), 0o755)
            .map_err(|e| VfsError::Other(format!("SFTP mkdir: {e}")))?;
        Ok(())
    }

    async fn delete(&self, path: &VPath, recursive: bool) -> Result<(), VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("handshake: {e}")))?;
        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw).map_err(|e| VfsError::Other(e.to_string()))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")), None)
                .map_err(|e| VfsError::Other(e.to_string()))?;
        }
        let sftp = sess.sftp().map_err(|e| VfsError::Other(e.to_string()))?;

        let stat = sftp.stat(std::path::Path::new(&self.full_path(path)))
            .map_err(|e| VfsError::Other(format!("stat: {e}")))?;
        if stat.is_dir() {
            if recursive {
                self.delete_dir_recursive(&sftp, std::path::Path::new(&self.full_path(path)))?;
            }
            sftp.rmdir(std::path::Path::new(&self.full_path(path)))
                .map_err(|e| VfsError::Other(format!("SFTP rmdir: {e}")))?;
        } else {
            sftp.unlink(std::path::Path::new(&self.full_path(path)))
                .map_err(|e| VfsError::Other(format!("SFTP unlink: {e}")))?;
        }
        Ok(())
    }

    async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError> {
        use ssh2::Session;
        use std::net::TcpStream;

        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VfsError::Other(format!("SFTP connect: {e}")))?;
        let mut sess = Session::new().map_err(|e| VfsError::Other(e.to_string()))?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| VfsError::Other(format!("handshake: {e}")))?;
        if let Some(ref pw) = self.config.password {
            sess.userauth_password(&self.config.user, pw).map_err(|e| VfsError::Other(e.to_string()))?;
        } else {
            sess.userauth_pubkey_file(&self.config.user, None,
                std::path::Path::new(self.config.key_path.as_deref().unwrap_or("")), None)
                .map_err(|e| VfsError::Other(e.to_string()))?;
        }
        let sftp = sess.sftp().map_err(|e| VfsError::Other(e.to_string()))?;
        sftp.rename(std::path::Path::new(&self.full_path(src)),
                    std::path::Path::new(&self.full_path(dst)), Default)
            .map_err(|e| VfsError::Other(format!("SFTP rename: {e}")))?;
        Ok(())
    }

    fn kind(&self) -> VfsKind { VfsKind::Sftp }
}

#[cfg(feature = "sftp")]
impl SftpVfs {
    fn delete_dir_recursive(&self, sftp: &ssh2::Sftp, path: &std::path::Path) -> Result<(), VfsError> {
        let mut dir = sftp.readdir(path).map_err(|e| VfsError::Other(format!("readdir: {e}")))?;
        for (child_path, stat) in dir.drain(..) {
            if stat.is_dir() {
                self.delete_dir_recursive(sftp, &child_path)?;
                sftp.rmdir(&child_path).map_err(|e| VfsError::Other(format!("rmdir: {e}")))?;
            } else {
                sftp.unlink(&child_path).map_err(|e| VfsError::Other(format!("unlink: {e}")))?;
            }
        }
        Ok(())
    }
}

// No std/net available without feature — provide clear compile-time message
#[cfg(not(feature = "sftp"))]
impl Vfs for SftpVfs {
    fn kind(&self) -> VfsKind { VfsKind::Sftp }
    async fn list(&self, _: &VPath) -> Result<Vec<Entry>, VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn stat(&self, _: &VPath) -> Result<Metadata, VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn read_all(&self, _: &VPath) -> Result<Vec<u8>, VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn write(&self, _: &VPath, _: &[u8]) -> Result<(), VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn mkdir(&self, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn delete(&self, _: &VPath, _: bool) -> Result<(), VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
    async fn rename(&self, _: &VPath, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("SFTP support requires `features = [\"sftp\"]` in Cargo.toml".into()))
    }
}
