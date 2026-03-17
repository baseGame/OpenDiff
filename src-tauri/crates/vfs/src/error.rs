use thiserror::Error;

#[derive(Debug, Error)]
pub enum VfsError {
    #[error("Path not found: {0}")]
    NotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not a directory: {0}")]
    NotADirectory(String),
    #[error("Already exists: {0}")]
    AlreadyExists(String),
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Authentication failed: {0}")]
    Auth(String),
    #[error("Unsupported operation: {0}")]
    Unsupported(String),
    #[error("Protocol error: {0}")]
    Protocol(String),
    #[error("{0}")]
    Other(String),
}
