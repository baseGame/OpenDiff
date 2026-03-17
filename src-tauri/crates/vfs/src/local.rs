use crate::{Vfs, VfsError, VfsKind, VPath, Entry, EntryKind, Metadata, ByteStream};
use async_trait::async_trait;
use bytes::Bytes;
use futures::stream;
use tokio::fs;

pub struct LocalVfs;

#[async_trait]
impl Vfs for LocalVfs {
    async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError> {
        let std_path = std::path::Path::new(path.as_str());
        let mut entries = vec![];
        let mut rd = fs::read_dir(std_path).await?;
        while let Some(e) = rd.next_entry().await? {
            let meta = e.metadata().await?;
            let name = e.file_name().to_string_lossy().into_owned();
            let vpath = path.join(&name);
            let kind = if meta.is_dir() { EntryKind::Directory }
                else if meta.is_symlink() { EntryKind::Symlink }
                else { EntryKind::File };
            entries.push(Entry {
                path: vpath,
                name,
                kind,
                metadata: Metadata::from_std(&meta),
            });
        }
        entries.sort_by(|a, b| {
            // Dirs first, then alphabetical
            match (&a.kind, &b.kind) {
                (EntryKind::Directory, EntryKind::Directory) => a.name.cmp(&b.name),
                (EntryKind::Directory, _) => std::cmp::Ordering::Less,
                (_, EntryKind::Directory) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        Ok(entries)
    }

    async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError> {
        let meta = fs::metadata(path.as_str()).await?;
        Ok(Metadata::from_std(&meta))
    }

    async fn read(&self, path: &VPath) -> Result<ByteStream, VfsError> {
        let data = fs::read(path.as_str()).await?;
        let s = stream::once(async move { Ok(Bytes::from(data)) });
        Ok(Box::pin(s))
    }

    async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError> {
        Ok(fs::read(path.as_str()).await?)
    }

    async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError> {
        if let Some(parent) = std::path::Path::new(path.as_str()).parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(path.as_str(), data).await?;
        Ok(())
    }

    async fn mkdir(&self, path: &VPath) -> Result<(), VfsError> {
        fs::create_dir_all(path.as_str()).await?;
        Ok(())
    }

    async fn delete(&self, path: &VPath, recursive: bool) -> Result<(), VfsError> {
        let p = std::path::Path::new(path.as_str());
        if p.is_dir() {
            if recursive {
                fs::remove_dir_all(p).await?;
            } else {
                fs::remove_dir(p).await?;
            }
        } else {
            fs::remove_file(p).await?;
        }
        Ok(())
    }

    async fn rename(&self, src: &VPath, dst: &VPath) -> Result<(), VfsError> {
        fs::rename(src.as_str(), dst.as_str()).await?;
        Ok(())
    }

    fn kind(&self) -> VfsKind { VfsKind::Local }
}
