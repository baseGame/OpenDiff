use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEndpoint, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use std::io::Read;
use std::time::Duration;

const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:displayname/>
  </d:prop>
</d:propfind>"#;

pub struct WebDavNetworkProvider {
    agent: ureq::Agent,
    base_url: String,
    authorization: String,
}

impl WebDavNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::WebDav {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let username = credential.username.as_deref().unwrap_or("");
        let password = credential_password(credential)?;
        let authorization = basic_authorization(username, password);
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(8))
            .timeout_read(Duration::from_secs(20))
            .timeout_write(Duration::from_secs(20))
            .build();

        Ok(Self {
            agent,
            base_url: webdav_base_url(&profile.endpoint),
            authorization,
        })
    }

    fn url_for(&self, path: &str) -> RemoteProviderResult<String> {
        let path = normalize_remote_path(path)?;
        Ok(join_url(&self.base_url, &path))
    }

    fn request(&self, method: &str, path: &str) -> RemoteProviderResult<ureq::Request> {
        let url = self.url_for(path)?;
        Ok(self
            .agent
            .request(method, &url)
            .set("Authorization", &self.authorization))
    }

    fn send_empty(&self, method: &str, path: &str) -> RemoteProviderResult<ureq::Response> {
        self.request(method, path)?
            .call()
            .map_err(|error| map_ureq_error(path, error))
    }
}

impl RemoteFileProvider for WebDavNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let request_path = normalize_remote_path(path)?;
        let response = self
            .request("PROPFIND", &request_path)?
            .set("Depth", "1")
            .set("Content-Type", "application/xml; charset=utf-8")
            .send_string(PROPFIND_BODY)
            .map_err(|error| map_ureq_error(&request_path, error))?;
        let xml = response
            .into_string()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(parse_dav_multistatus(&xml, &request_path))
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let response = self.send_empty("GET", &path).map_err(|error| match error {
            RemoteProviderError::Backend(_) => error,
            other => other,
        })?;
        let mut bytes = Vec::new();
        response
            .into_reader()
            .read_to_end(&mut bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(bytes)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        self.request("PUT", &path)?
            .set("Content-Type", "application/octet-stream")
            .send_bytes(&bytes)
            .map_err(|error| map_ureq_error(&path, error))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        self.send_empty("DELETE", &path)?;
        Ok(())
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let destination = self.url_for(to)?;
        self.request("MOVE", &from)?
            .set("Destination", &destination)
            .set("Overwrite", "T")
            .call()
            .map_err(|error| map_ureq_error(&from, error))?;
        Ok(())
    }

    fn mkdir(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        self.send_empty("MKCOL", &path)?;
        Ok(())
    }
}

pub fn webdav_base_url(endpoint: &RemoteEndpoint) -> String {
    let host = endpoint.host.trim().trim_end_matches('/');
    if host.starts_with("http://") || host.starts_with("https://") {
        return join_url(host, endpoint.root_path.as_deref().unwrap_or("/"));
    }

    let https = endpoint.port == Some(443);
    let scheme = if https { "https" } else { "http" };
    let port = endpoint.port.unwrap_or(if https { 443 } else { 80 });
    let authority = if (https && port == 443) || (!https && port == 80) {
        host.to_owned()
    } else {
        format!("{host}:{port}")
    };
    join_url(
        &format!("{scheme}://{authority}"),
        endpoint.root_path.as_deref().unwrap_or("/"),
    )
}

fn join_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    let path = if path.is_empty() { "/" } else { path };
    if path == "/" {
        format!("{base}/")
    } else if path.starts_with('/') {
        format!("{base}{path}")
    } else {
        format!("{base}/{path}")
    }
}

fn credential_password(credential: &RemoteCredential) -> RemoteProviderResult<&str> {
    match &credential.material {
        RemoteCredentialMaterial::Password(secret) => Ok(secret.expose_secret()),
        RemoteCredentialMaterial::BearerToken(secret) => Ok(secret.expose_secret()),
        RemoteCredentialMaterial::PrivateKey { .. } => Err(RemoteProviderError::Backend(
            "WebDAV requires a password or bearer token credential".to_owned(),
        )),
    }
}

fn basic_authorization(username: &str, password: &str) -> String {
    format!(
        "Basic {}",
        base64_encode(format!("{username}:{password}").as_bytes())
    )
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::new();
    let mut index = 0;

    while index < bytes.len() {
        let remaining = bytes.len() - index;
        let b0 = bytes[index];
        let b1 = if remaining > 1 { bytes[index + 1] } else { 0 };
        let b2 = if remaining > 2 { bytes[index + 2] } else { 0 };
        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if remaining > 1 {
            output.push(TABLE[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if remaining > 2 {
            output.push(TABLE[(b2 & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
        index += 3;
    }

    output
}

fn map_ureq_error(path: &str, error: ureq::Error) -> RemoteProviderError {
    match error {
        ureq::Error::Status(404, _) => RemoteProviderError::NotFound(path.to_owned()),
        ureq::Error::Status(412, _) | ureq::Error::Status(409, _) => {
            RemoteProviderError::AlreadyExists(path.to_owned())
        }
        ureq::Error::Status(code, response) => {
            let body = response.into_string().unwrap_or_default();
            RemoteProviderError::Backend(format!("HTTP {code}: {body}"))
        }
        other => RemoteProviderError::Backend(other.to_string()),
    }
}

fn parse_dav_multistatus(xml: &str, request_path: &str) -> Vec<RemoteEntry> {
    let mut entries = Vec::new();
    let mut rest = xml;
    let request_href = normalize_href_path(request_path);

    while let Some(start) = find_ci(rest, "<d:response")
        .or_else(|| find_ci(rest, "<D:response"))
        .or_else(|| find_ci(rest, "<response"))
    {
        let after = &rest[start..];
        let end = find_ci(after, "</d:response>")
            .or_else(|| find_ci(after, "</D:response>"))
            .or_else(|| find_ci(after, "</response>"))
            .map(|index| index + "</response>".len())
            .unwrap_or(after.len());
        let block = &after[..end.min(after.len())];
        if let Some(href) = extract_tagged_text(block, "href") {
            let entry_path = href_to_remote_path(&href);
            if normalize_href_path(&entry_path) != request_href {
                let is_dir = contains_ci(block, "<d:collection")
                    || contains_ci(block, "<D:collection")
                    || contains_ci(block, "<collection")
                    || href.ends_with('/');
                let size = extract_tagged_text(block, "getcontentlength")
                    .and_then(|value| value.trim().parse().ok())
                    .unwrap_or(0);
                entries.push(RemoteEntry {
                    path: entry_path,
                    kind: if is_dir {
                        RemoteEntryKind::Directory
                    } else {
                        RemoteEntryKind::File
                    },
                    size,
                });
            }
        }
        rest = if end < after.len() { &after[end..] } else { "" };
        if rest.is_empty() {
            break;
        }
    }

    entries
}

fn extract_tagged_text(xml: &str, tag: &str) -> Option<String> {
    let start_token = format!("<{tag}");
    let end_token = format!("</{tag}>");
    let start = find_ci(xml, &start_token)
        .or_else(|| find_ci(xml, &format!("<d:{tag}")))
        .or_else(|| find_ci(xml, &format!("<D:{tag}")))?;
    let after_start = &xml[start..];
    let inner_start = after_start.find('>')? + 1;
    let close = find_ci(&after_start[inner_start..], &end_token)
        .or_else(|| find_ci(&after_start[inner_start..], &format!("</d:{tag}>")))
        .or_else(|| find_ci(&after_start[inner_start..], &format!("</D:{tag}>")))?;
    Some(
        after_start[inner_start..inner_start + close]
            .trim()
            .to_owned(),
    )
}

fn href_to_remote_path(href: &str) -> String {
    let without_scheme = href
        .split_once("://")
        .map(|(_, rest)| rest.split_once('/').map(|(_, path)| path).unwrap_or(""))
        .unwrap_or(href.trim());
    let decoded = decode_href(without_scheme.trim());
    normalize_remote_path(&decoded).unwrap_or_else(|_| {
        if decoded.starts_with('/') {
            decoded
        } else {
            format!("/{decoded}")
        }
    })
}

fn normalize_href_path(path: &str) -> String {
    normalize_remote_path(path)
        .unwrap_or_else(|_| path.trim_end_matches('/').to_owned())
        .trim_end_matches('/')
        .to_owned()
}

fn decode_href(value: &str) -> String {
    let mut output = String::new();
    let bytes = value.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or(""),
                16,
            ) {
                output.push(byte as char);
                index += 3;
                continue;
            }
        }
        output.push(bytes[index] as char);
        index += 1;
    }

    output
}

fn find_ci(haystack: &str, needle: &str) -> Option<usize> {
    haystack
        .to_ascii_lowercase()
        .find(&needle.to_ascii_lowercase())
}

fn contains_ci(haystack: &str, needle: &str) -> bool {
    find_ci(haystack, needle).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};
    use std::collections::BTreeMap;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};
    use std::thread;

    #[test]
    fn builds_http_base_url_from_host_port_and_root() {
        let endpoint = RemoteEndpoint::new("dav.example.com")
            .with_port(8080)
            .with_root_path("/shared");

        assert_eq!(
            webdav_base_url(&endpoint),
            "http://dav.example.com:8080/shared"
        );
    }

    #[test]
    fn lists_reads_writes_mkdirs_and_deletes_against_a_real_http_server() {
        let server = MockWebDavServer::start();
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("127.0.0.1")
                .with_port(server.port)
                .with_root_path("/shared"),
            CredentialReference::profile_store("team-webdav"),
        );
        let credential = crate::RemoteCredential::username_password("user", "secret");
        let mut provider = WebDavNetworkProvider::connect(&profile, &credential).unwrap();

        provider.mkdir("/shared/docs").unwrap();
        provider
            .upload("/shared/docs/readme.md", b"# Docs".to_vec())
            .unwrap();

        let entries = provider.list("/shared/docs").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "/shared/docs/readme.md");
        assert_eq!(
            provider.download("/shared/docs/readme.md").unwrap(),
            b"# Docs"
        );

        provider
            .rename("/shared/docs/readme.md", "/shared/docs/notes.md")
            .unwrap();
        provider.delete("/shared/docs/notes.md").unwrap();
        assert!(provider.list("/shared/docs").unwrap().is_empty());
    }

    struct MockWebDavServer {
        port: u16,
        _files: Arc<Mutex<BTreeMap<String, Vec<u8>>>>,
    }

    impl MockWebDavServer {
        fn start() -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock webdav");
            let port = listener.local_addr().expect("addr").port();
            let files = Arc::new(Mutex::new(BTreeMap::<String, Vec<u8>>::new()));
            let files_for_thread = Arc::clone(&files);

            thread::spawn(move || {
                listener.set_nonblocking(false).ok();
                for stream in listener.incoming().flatten() {
                    let _ = handle_mock_request(stream, &files_for_thread);
                }
            });

            Self {
                port,
                _files: files,
            }
        }
    }

    fn handle_mock_request(
        mut stream: std::net::TcpStream,
        files: &Arc<Mutex<BTreeMap<String, Vec<u8>>>>,
    ) -> std::io::Result<()> {
        stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
        let mut buffer = [0u8; 16_384];
        let read = stream.read(&mut buffer)?;
        let request = String::from_utf8_lossy(&buffer[..read]);
        let mut lines = request.split("\r\n");
        let request_line = lines.next().unwrap_or_default();
        let mut parts = request_line.split_whitespace();
        let method = parts.next().unwrap_or_default().to_ascii_uppercase();
        let raw_path = parts.next().unwrap_or("/");
        let path = raw_path.split('?').next().unwrap_or(raw_path);
        let headers = request.split("\r\n\r\n").next().unwrap_or("");
        let authorized = headers.contains("Authorization: Basic ");
        let body = request.split("\r\n\r\n").nth(1).unwrap_or("").as_bytes();

        if !authorized {
            write_response(&mut stream, 401, "text/plain", b"unauthorized")?;
            return Ok(());
        }

        let mut store = files.lock().expect("lock");
        match method.as_str() {
            "PROPFIND" => {
                let prefix = path.trim_end_matches('/').to_owned();
                let mut xml = String::from(
                    r#"<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>"#,
                );
                xml.push_str(path);
                xml.push_str("</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>");
                for (file_path, bytes) in store.iter() {
                    if file_path.starts_with(&format!("{prefix}/"))
                        && !file_path[prefix.len() + 1..].contains('/')
                    {
                        xml.push_str("<d:response><d:href>");
                        xml.push_str(file_path);
                        xml.push_str(
                            "</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>",
                        );
                        xml.push_str(&bytes.len().to_string());
                        xml.push_str("</d:getcontentlength></d:prop></d:propstat></d:response>");
                    }
                }
                xml.push_str("</d:multistatus>");
                write_response(&mut stream, 207, "application/xml", xml.as_bytes())?;
            }
            "GET" => {
                if let Some(bytes) = store.get(path) {
                    write_response(&mut stream, 200, "application/octet-stream", bytes)?;
                } else {
                    write_response(&mut stream, 404, "text/plain", b"missing")?;
                }
            }
            "PUT" => {
                store.insert(path.to_owned(), body.to_vec());
                write_response(&mut stream, 201, "text/plain", b"created")?;
            }
            "DELETE" => {
                if store.remove(path).is_some() {
                    write_response(&mut stream, 204, "text/plain", b"")?;
                } else {
                    write_response(&mut stream, 404, "text/plain", b"missing")?;
                }
            }
            "MKCOL" => {
                write_response(&mut stream, 201, "text/plain", b"created")?;
            }
            "MOVE" => {
                let destination = headers
                    .lines()
                    .find(|line| line.to_ascii_lowercase().starts_with("destination:"))
                    .and_then(|line| line.split_once(':').map(|x| x.1))
                    .map(str::trim)
                    .map(href_to_remote_path)
                    .unwrap_or_default();
                if let Some(bytes) = store.remove(path) {
                    store.insert(destination, bytes);
                    write_response(&mut stream, 201, "text/plain", b"moved")?;
                } else {
                    write_response(&mut stream, 404, "text/plain", b"missing")?;
                }
            }
            _ => write_response(&mut stream, 405, "text/plain", b"method")?,
        }

        Ok(())
    }

    fn write_response(
        stream: &mut std::net::TcpStream,
        status: u16,
        content_type: &str,
        body: &[u8],
    ) -> std::io::Result<()> {
        let reason = match status {
            200 => "OK",
            201 => "Created",
            204 => "No Content",
            207 => "Multi-Status",
            401 => "Unauthorized",
            404 => "Not Found",
            405 => "Method Not Allowed",
            _ => "OK",
        };
        let header = format!(
            "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream.write_all(header.as_bytes())?;
        stream.write_all(body)?;
        Ok(())
    }
}
