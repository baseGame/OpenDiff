use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEndpoint, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use std::cell::RefCell;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;

pub fn protocol_is_implemented(protocol: RemoteProtocol) -> bool {
    matches!(protocol, RemoteProtocol::Sftp | RemoteProtocol::Ftp)
}

pub fn unimplemented_protocol_message(protocol: RemoteProtocol) -> String {
    format!("{protocol:?} is unimplemented; only SFTP and FTP connections are live")
}

pub fn test_network_connection(
    profile: &RemoteProfile,
    credential: &RemoteCredential,
) -> RemoteProviderResult<String> {
    match profile.protocol {
        RemoteProtocol::Sftp => {
            let provider = SftpNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "SFTP connected to {}:{} and listed {} entries",
                profile.endpoint.host,
                profile.endpoint.port.unwrap_or(22),
                entries.len()
            ))
        }
        RemoteProtocol::Ftp => {
            let provider = FtpNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "FTP connected to {}:{} and listed {} entries",
                profile.endpoint.host,
                profile.endpoint.port.unwrap_or(21),
                entries.len()
            ))
        }
        other => Err(RemoteProviderError::UnsupportedProtocol(other)),
    }
}

pub fn open_network_provider(
    profile: &RemoteProfile,
    credential: &RemoteCredential,
) -> RemoteProviderResult<Box<dyn RemoteFileProvider>> {
    match profile.protocol {
        RemoteProtocol::Sftp => Ok(Box::new(SftpNetworkProvider::connect(profile, credential)?)),
        RemoteProtocol::Ftp => Ok(Box::new(FtpNetworkProvider::connect(profile, credential)?)),
        other => Err(RemoteProviderError::UnsupportedProtocol(other)),
    }
}

pub struct SftpNetworkProvider {
    session: ssh2::Session,
}

impl SftpNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Sftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let mut session = ssh2::Session::new()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let stream = connect_tcp(&profile.endpoint, 22)?;
        session.set_tcp_stream(stream);
        session
            .handshake()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        authenticate_sftp(&session, credential)?;

        Ok(Self { session })
    }

    fn sftp(&self) -> RemoteProviderResult<ssh2::Sftp> {
        self.session
            .sftp()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }
}

impl RemoteFileProvider for SftpNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let entries = sftp
            .readdir(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;

        Ok(entries
            .into_iter()
            .map(|(entry_path, stat)| {
                let kind = if stat.is_dir() {
                    RemoteEntryKind::Directory
                } else {
                    RemoteEntryKind::File
                };
                RemoteEntry {
                    path: normalize_remote_path(&entry_path.to_string_lossy())
                        .unwrap_or_else(|_| entry_path.to_string_lossy().into_owned()),
                    kind,
                    size: stat.size.unwrap_or(0),
                }
            })
            .collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let mut file = sftp
            .open(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(bytes)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let mut file = sftp
            .create(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;
        file.write_all(&bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        sftp.unlink(Path::new(&path))
            .or_else(|_| sftp.rmdir(Path::new(&path)))
            .map_err(|error| map_ssh_error(&path, error))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        let sftp = self.sftp()?;
        sftp.rename(Path::new(&from), Path::new(&to), None)
            .map_err(|error| map_ssh_error(&from, error))
    }
}

pub struct FtpNetworkProvider {
    stream: RefCell<suppaftp::FtpStream>,
}

impl FtpNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Ftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let address = socket_address(&profile.endpoint, 21);
        let mut stream = suppaftp::FtpStream::connect(&address)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let username = credential_username(credential)?;
        let password = credential_password(credential)?;
        stream
            .login(username, password)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(Self {
            stream: RefCell::new(stream),
        })
    }
}

impl RemoteFileProvider for FtpNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let names = self
            .stream
            .borrow_mut()
            .nlst(Some(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(names
            .into_iter()
            .map(|name| {
                let entry_path = if name.starts_with('/') {
                    name
                } else if path == "/" {
                    format!("/{name}")
                } else {
                    format!("{path}/{name}")
                };
                RemoteEntry {
                    path: entry_path,
                    kind: RemoteEntryKind::File,
                    size: 0,
                }
            })
            .collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let cursor = self
            .stream
            .borrow_mut()
            .retr_as_buffer(&path)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(cursor.into_inner())
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut cursor = std::io::Cursor::new(bytes);
        self.stream
            .borrow_mut()
            .put_file(&path, &mut cursor)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut stream = self.stream.borrow_mut();
        stream
            .rm(&path)
            .or_else(|_| stream.rmdir(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        self.stream
            .borrow_mut()
            .rename(&from, &to)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }
}

fn connect_tcp(endpoint: &RemoteEndpoint, default_port: u16) -> RemoteProviderResult<TcpStream> {
    let address = socket_address(endpoint, default_port);
    let stream = TcpStream::connect_timeout(&resolve_address(&address)?, Duration::from_secs(8))
        .map_err(|error| RemoteProviderError::Backend(format!("connect failed: {error}")))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(15)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(15)))
        .ok();
    Ok(stream)
}

fn socket_address(endpoint: &RemoteEndpoint, default_port: u16) -> String {
    format!("{}:{}", endpoint.host, endpoint.port.unwrap_or(default_port))
}

fn resolve_address(address: &str) -> RemoteProviderResult<std::net::SocketAddr> {
    address
        .to_socket_addrs()
        .map_err(|error| RemoteProviderError::Backend(error.to_string()))?
        .next()
        .ok_or_else(|| RemoteProviderError::Backend(format!("could not resolve {address}")))
}

fn authenticate_sftp(
    session: &ssh2::Session,
    credential: &RemoteCredential,
) -> RemoteProviderResult<()> {
    let username = credential_username(credential)?;

    match &credential.material {
        RemoteCredentialMaterial::Password(secret) => session
            .userauth_password(username, secret.expose_secret())
            .map_err(|error| RemoteProviderError::Backend(error.to_string())),
        RemoteCredentialMaterial::PrivateKey {
            private_key,
            passphrase,
        } => session
            .userauth_pubkey_memory(
                username,
                None,
                private_key.expose_secret(),
                passphrase.as_ref().map(|value| value.expose_secret()),
            )
            .map_err(|error| RemoteProviderError::Backend(error.to_string())),
        RemoteCredentialMaterial::BearerToken(_) => Err(RemoteProviderError::Backend(
            "SFTP does not support bearer token authentication".to_owned(),
        )),
    }
}

fn credential_username(credential: &RemoteCredential) -> RemoteProviderResult<&str> {
    credential.username.as_deref().ok_or_else(|| {
        RemoteProviderError::Backend("username is required for SFTP/FTP".to_owned())
    })
}

fn credential_password(credential: &RemoteCredential) -> RemoteProviderResult<&str> {
    match &credential.material {
        RemoteCredentialMaterial::Password(secret) => Ok(secret.expose_secret()),
        _ => Err(RemoteProviderError::Backend(
            "FTP requires a password credential".to_owned(),
        )),
    }
}

fn map_ssh_error(path: &str, error: ssh2::Error) -> RemoteProviderError {
    if error.code() == ssh2::ErrorCode::Session(-31) {
        RemoteProviderError::NotFound(path.to_owned())
    } else {
        RemoteProviderError::Backend(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};

    #[test]
    fn sftp_test_connection_performs_a_real_tcp_connect() {
        let profile = RemoteProfile::new(
            "closed-sftp",
            "Closed SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("127.0.0.1").with_port(1),
            CredentialReference::profile_store("closed-sftp"),
        );
        let credential = RemoteCredential::username_password("deploy", "secret");
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::Backend(message) if message.contains("connect failed")
        ));
    }

    #[test]
    fn unsupported_protocols_are_rejected_instead_of_using_memory_providers() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com"),
            CredentialReference::profile_store("team-webdav"),
        );
        let credential = RemoteCredential::username_password("user", "secret");
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::WebDav)
        ));
        assert!(!protocol_is_implemented(RemoteProtocol::WebDav));
        assert!(protocol_is_implemented(RemoteProtocol::Sftp));
    }
}
