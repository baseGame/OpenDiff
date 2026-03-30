pub mod local;
pub mod types;
pub mod error;
#[cfg(feature = "sftp")]
pub mod sftp;
#[cfg(feature = "ftp")]
pub mod ftp;
#[cfg(feature = "webdav")]
pub mod webdav;
#[cfg(feature = "s3")]
pub mod s3;
#[cfg(test)]
mod tests;

pub use types::*;
pub use error::VfsError;
pub use local::LocalVfs;

#[cfg(feature = "sftp")]
pub use sftp::SftpVfs;

#[cfg(feature = "ftp")]
pub use ftp::FtpVfs;

#[cfg(feature = "webdav")]
pub use webdav::WebDavVfs;

#[cfg(feature = "s3")]
pub use s3::{S3Vfs, parse_s3_url, S3Config};

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use std::pin::Pin;

pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Bytes, VfsError>> + Send>>;
pub type EventStream = Pin<Box<dyn Stream<Item = VfsEvent> + Send>>;

/// Unified Virtual File System trait — implemented by all backends.
#[async_trait]
pub trait Vfs: Send + Sync {
    /// List entries in a directory.
    async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError>;

    /// Get metadata for a path.
    async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError>;

    /// Read file as a byte stream.
    async fn read(&self, path: &VPath) -> Result<ByteStream, VfsError>;

    /// Read entire file into memory.
    async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError>;

    /// Write data to a file (truncates if exists).
    async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError>;

    /// Create directory (recursive by default).
    async fn mkdir(&self, path: &VPath) -> Result<(), VfsError>;

    /// Delete file or directory.
    async fn delete(&self, path: &VPath, recursive: bool) -> Result<(), VfsError>;

    /// Rename / move within same VFS.
    async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError>;

    /// Watch for changes (local VFS only; remote returns None).
    fn watch(&self, _path: &VPath) -> Option<EventStream> { None }

    /// VFS backend kind identifier.
    fn kind(&self) -> VfsKind;
}

/// Parse a VFS connection URL and return the appropriate Vfs instance.
pub async fn open(url: &str) -> Result<Box<dyn Vfs>, VfsError> {
    let url = url.trim();

    // Detect scheme and dispatch
    if url.starts_with("s3://") {
        #[cfg(feature = "s3")]
        {
            let config = parse_s3_url(url)?;
            let vfs = S3Vfs::new(config).await?;
            return Ok(Box::new(vfs) as Box<dyn Vfs>);
        }
        #[cfg(not(feature = "s3"))]
        return Err(VfsError::Other(
            "S3 support not compiled. Add `s3` to the `features` list in Cargo.toml.".into()
        ));
    }

    if url.starts_with("sftp://") || url.starts_with("ssh://") {
        #[cfg(feature = "sftp")]
        {
            let vfs = SftpVfs::from_url(url)?;
            return Ok(Box::new(vfs) as Box<dyn Vfs>);
        }
        #[cfg(not(feature = "sftp"))]
        return Err(VfsError::Other(
            "SFTP support not compiled. Add `sftp` to the `features` list in Cargo.toml.".into()
        ));
    }

    if url.starts_with("ftp://") || url.starts_with("ftps://") || url.starts_with("ftpes://") {
        #[cfg(feature = "ftp")]
        {
            let vfs = FtpVfs::from_url(url)?;
            return Ok(Box::new(vfs) as Box<dyn Vfs>);
        }
        #[cfg(not(feature = "ftp"))]
        return Err(VfsError::Other(
            "FTP support not compiled. Add `ftp` to the `features` list in Cargo.toml.".into()
        ));
    }

    if url.starts_with("webdav://") || url.starts_with("webdavs://") || url.starts_with("onedrive://") {
        #[cfg(feature = "webdav")]
        {
            let vfs = WebDavVfs::from_url(url)?;
            return Ok(Box::new(vfs) as Box<dyn Vfs>);
        }
        #[cfg(not(feature = "webdav"))]
        return Err(VfsError::Other(
            "WebDAV support not compiled. Add `webdav` to the `features` list in Cargo.toml.".into()
        ));
    }

    if url.starts_with("local://") || url.contains("://") {
        return Err(VfsError::Other(format!("unknown scheme in URL: {url}")));
    }

    // Default: treat as local path
    #[cfg(feature = "local")]
    {
        let vfs = LocalVfs;
        Ok(Box::new(vfs) as Box<dyn Vfs>)
    }

    #[cfg(not(feature = "local"))]
    Err(VfsError::Other("No local filesystem support compiled.".into()))
}
