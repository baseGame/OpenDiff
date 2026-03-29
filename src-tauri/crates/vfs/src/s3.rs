//! S3 VFS backend — connects to AWS S3 or any S3-compatible store (MinIO, R2, etc.)
//!
//! Requires: `features = ["s3"]` in Cargo.toml.
//!
//! Connection URL format:
//! `s3://access_key:secret_key@region/bucket/path`

use crate::{Vfs, VfsError, VfsKind, Entry, EntryKind, Metadata, VPath};
use async_trait::async_trait;
use std::sync::Arc;

/// S3 VFS configuration.
#[derive(Debug, Clone)]
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub endpoint: Option<String>,  // For MinIO / R2 / etc.
    pub access_key: String,
    pub secret_key: String,
    pub base_path: Option<VPath>,
}

impl S3Config {
    pub fn new(bucket: &str, region: &str, access_key: &str, secret_key: &str) -> Self {
        Self {
            bucket: bucket.into(),
            region: region.into(),
            endpoint: None,
            access_key: access_key.into(),
            secret_key: secret_key.into(),
            base_path: None,
        }
    }

    pub fn with_endpoint(mut self, endpoint: &str) -> Self {
        self.endpoint = Some(endpoint.into());
        self
    }

    pub fn with_base_path(mut self, path: &str) -> Self {
        self.base_path = Some(VPath::new(path));
        self
    }
}

/// Parse URL like `s3://access_key:secret_key@us-east-1/bucket-name/prefix/path`
pub fn parse_s3_url(url_str: &str) -> Result<S3Config, VfsError> {
    let u = url::Url::parse(url_str)
        .map_err(|e| VfsError::InvalidPath(url_str.into(), e.to_string()))?;

    if u.scheme() != "s3" {
        return Err(VfsError::InvalidPath(url_str.into(), "expected scheme s3://".into()));
    }

    let host = u.host_str()
        .ok_or_else(|| VfsError::InvalidPath(url_str.into(), "missing bucket".into()))?;
    let bucket = host.to_string();
    let region = u.username()
        .or_else(|| std::env::var("AWS_DEFAULT_REGION").ok().as_deref())
        .unwrap_or("us-east-1");
    let access_key = u.username();
    let secret_key = u.password().unwrap_or("");
    let path = u.path().trim_start_matches('/');

    // Extract prefix from path (path = bucket/prefix...)
    let path_parts: Vec<&str> = path.splitn(2, '/').collect();
    let base_path = path_parts.get(1).filter(|p| !p.is_empty()).map(|p| VPath::new(p));

    Ok(S3Config {
        bucket,
        region: region.into(),
        endpoint: None,
        access_key: access_key.into(),
        secret_key: secret_key.into(),
        base_path,
    })
}

#[cfg(feature = "s3")]
mod s3_impl {
    use super::*;
    use aws_config::Region;
    use aws_sdk_s3::config::{Builder as S3Builder, Credentials, ProviderConfig};
    use aws_sdk_s3::primitives::DateTime;
    use aws_sdk_s3::Client as S3Client;
    use std::time::Duration;

    pub struct S3VfsInner {
        pub client: S3Client,
        pub config: S3Config,
    }

    impl S3VfsInner {
        pub async fn new(config: S3Config) -> Result<Self, VfsError> {
            let creds = Credentials::new(
                &config.access_key,
                &config.secret_key,
                None, None, None, "opendiff",
            );
            let mut cfg = S3Builder::new()
                .credentials_provider(creds)
                .region(Region::new(config.region.clone()));

            if let Some(ref endpoint) = config.endpoint {
                cfg = cfg.endpoint_url(endpoint);
            }

            let client = Client::new(&cfg.build());
            Ok(Self { client, config })
        }

        fn key_for(&self, path: &VPath) -> String {
            let p = path.as_str().trim_start_matches('/');
            match &self.config.base_path {
                Some(base) => format!("{}/{}", base.as_str().trim_end_matches('/'), p),
                None => p.to_string(),
            }
        }

        fn path_for(&self, key: &str) -> VPath {
            let without_base = match &self.config.base_path {
                Some(base) => key.strip_prefix(&format!("{}/", base.as_str().trim_end_matches('/')))
                    .unwrap_or(key),
                None => key,
            };
            VPath::new(without_base)
        }
    }

    #[async_trait]
    impl Vfs for S3VfsInner {
        async fn list(&self, path: &VPath) -> Result<Vec<Entry>, VfsError> {
            use aws_sdk_s3::types::Trait;
            let prefix = self.key_for(path);
            let prefix_with_slash = if prefix.is_empty() { None } else { Some(format!("{}/", prefix)) };

            let resp = self.client
                .list_objects_v2()
                .bucket(&self.config.bucket)
                .delimiter('/')
                .prefix(prefix_with_slash.as_deref().unwrap_or(""))
                .send()
                .await
                .map_err(|e| VfsError::Other(format!("S3 list: {e}")))?;

            let mut entries = Vec::new();

            // Common prefixes (subdirectories)
            for cp in resp.common_prefixes() {
                let prefix = cp.prefix().unwrap_or("/");
                let name = prefix.trim_end_matches('/')
                    .rsplit('/').next().unwrap_or("")
                    .to_string();
                let key = prefix.trim_end_matches('/');
                entries.push(Entry {
                    path: self.path_for(key),
                    name,
                    kind: EntryKind::Directory,
                    metadata: Metadata {
                        size: None, modified: None, created: None,
                        is_dir: true, is_symlink: false, readonly: false, permissions: None,
                    },
                });
            }

            // Objects
            for obj in resp.contents() {
                let key = obj.key().unwrap_or("");
                let name = key.rsplit('/').next().unwrap_or(key).to_string();
                let modified = obj.last_modified()
                    .and_then(|dt: &DateTime| dt.to_chrono_utc().ok())
                    .map(|dt| dt.timestamp_millis() as u64);
                let size = obj.size();

                entries.push(Entry {
                    path: self.path_for(key),
                    name,
                    kind: EntryKind::File,
                    metadata: Metadata {
                        size: Some(size),
                        modified,
                        created: None,
                        is_dir: false,
                        is_symlink: false,
                        readonly: false,
                        permissions: None,
                    },
                });
            }

            Ok(entries)
        }

        async fn stat(&self, path: &VPath) -> Result<Metadata, VfsError> {
            let key = self.key_for(path);
            let resp = self.client
                .head_object()
                .bucket(&self.config.bucket)
                .key(&key)
                .send()
                .await
                .map_err(|e| {
                    if e.to_string().contains("NoSuchKey") {
                        VfsError::NotFound(key.into())
                    } else {
                        VfsError::Other(format!("S3 head: {e}"))
                    }
                })?;

            let modified = resp.last_modified()
                .and_then(|dt| dt.to_chrono_utc().ok())
                .map(|dt| dt.timestamp_millis() as u64);

            Ok(Metadata {
                size: resp.content_length(),
                modified,
                created: None,
                is_dir: false,
                is_symlink: false,
                readonly: false,
                permissions: None,
            })
        }

        async fn read_all(&self, path: &VPath) -> Result<Vec<u8>, VfsError> {
            let key = self.key_for(path);
            let resp = self.client
                .get_object()
                .bucket(&self.config.bucket)
                .key(&key)
                .send()
                .await
                .map_err(|e| {
                    if e.to_string().contains("NoSuchKey") {
                        VfsError::NotFound(key.into())
                    } else {
                        VfsError::Other(format!("S3 get: {e}"))
                    }
                })?;
            let bytes = resp.body.collect().await
                .map_err(|e| VfsError::Other(format!("S3 read body: {e}")))?;
            Ok(bytes.into_bytes())
        }

        async fn write(&self, path: &VPath, data: &[u8]) -> Result<(), VfsError> {
            let key = self.key_for(path);
            self.client
                .put_object()
                .bucket(&self.config.bucket)
                .key(&key)
                .body(aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
                .send()
                .await
                .map_err(|e| VfsError::Other(format!("S3 put: {e}")))?;
            Ok(())
        }

        async fn delete(&self, path: &VPath, _recursive: bool) -> Result<(), VfsError> {
            let key = self.key_for(path);
            self.client
                .delete_object()
                .bucket(&self.config.bucket)
                .key(&key)
                .send()
                .await
                .map_err(|e| VfsError::Other(format!("S3 delete: {e}")))?;
            Ok(())
        }

        async fn mkdir(&self, path: &VPath) -> Result<(), VfsError> {
            // S3 has no real directories — create a zero-byte "folder marker" object
            let key = format!("{}/", self.key_for(path).trim_end_matches('/'));
            self.client
                .put_object()
                .bucket(&self.config.bucket)
                .key(&key)
                .body(aws_sdk_s3::primitives::ByteStream::from(Vec::new()))
                .send()
                .await
                .map_err(|e| VfsError::Other(format!("S3 mkdir: {e}")))?;
            Ok(())
        }

        async fn rename(&self, _src: &VPath, _dst: &VPath) -> Result<(), VfsError> {
            // S3 rename = copy + delete (not atomic but unavoidable)
            Err(VfsError::Other("S3 rename not implemented (use copy+delete)".into()))
        }

        fn kind(&self) -> VfsKind { VfsKind::S3 }
    }
}

#[cfg(feature = "s3")]
pub use s3_impl::S3VfsInner as S3Vfs;

#[cfg(not(feature = "s3"))]
pub struct S3Vfs { _priv: () }

#[cfg(not(feature = "s3"))]
impl S3Vfs {
    pub fn from_url(_url: &str) -> Result<Self, VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    pub fn new(_config: S3Config) -> Result<Self, VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
}

#[cfg(not(feature = "s3"))]
#[async_trait]
impl Vfs for S3Vfs {
    fn kind(&self) -> VfsKind { VfsKind::S3 }
    async fn list(&self, _: &VPath) -> Result<Vec<Entry>, VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn stat(&self, _: &VPath) -> Result<Metadata, VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn read_all(&self, _: &VPath) -> Result<Vec<u8>, VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn write(&self, _: &VPath, _: &[u8]) -> Result<(), VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn mkdir(&self, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn delete(&self, _: &VPath, _: bool) -> Result<(), VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
    async fn rename(&self, _: &VPath, _: &VPath) -> Result<(), VfsError> {
        Err(VfsError::Other("S3 support requires `features = [\"s3\"]` in Cargo.toml".into()))
    }
}
