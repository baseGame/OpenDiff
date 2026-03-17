pub mod local;
pub mod types;
pub mod error;

pub use types::*;
pub use error::VfsError;
pub use local::LocalVfs;

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use std::pin::Pin;

pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Bytes, VfsError>> + Send>>;
pub type EventStream = Pin<Box<dyn Stream<Item = VfsEvent> + Send>>;

/// Unified Virtual File System trait
#[async_trait]
pub trait Vfs: Send + Sync {
    /// List entries in a directory
    async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError>;

    /// Get metadata for a path
    async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError>;

    /// Read file as a stream of bytes
    async fn read(&self, path: &VPath) -> Result<ByteStream, VfsError>;

    /// Read entire file into memory (convenience)
    async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError>;

    /// Write data to a file
    async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError>;

    /// Create directory (and parents if needed)
    async fn mkdir(&self, path: &VPath) -> Result<(), VfsError>;

    /// Delete file or directory
    async fn delete(&self, path: &VPath, recursive: bool) -> Result<(), VfsError>;

    /// Rename / move within same VFS
    async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError>;

    /// Watch for changes (only local VFS implements this)
    fn watch(&self, _path: &VPath) -> Option<EventStream> { None }

    /// VFS kind identifier
    fn kind(&self) -> VfsKind;
}
