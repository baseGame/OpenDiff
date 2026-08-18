use crate::{RemoteProtocol, RemoteProviderError, RemoteProviderResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteUri {
    pub protocol: RemoteProtocol,
    pub profile_ref: String,
    pub remote_path: String,
}

pub fn parse_remote_uri(value: &str) -> RemoteProviderResult<RemoteUri> {
    let value = value.trim();
    let Some((scheme, rest)) = value.split_once("://") else {
        return Err(RemoteProviderError::InvalidPath(
            "remote URI must look like sftp://profile/<id>/<path>".to_owned(),
        ));
    };

    let protocol = match scheme.to_ascii_lowercase().as_str() {
        "sftp" => RemoteProtocol::Sftp,
        "ftp" => RemoteProtocol::Ftp,
        "ftps" => RemoteProtocol::Ftps,
        "webdav" | "dav" => RemoteProtocol::WebDav,
        "s3" => RemoteProtocol::S3,
        "dropbox" => RemoteProtocol::Dropbox,
        "onedrive" => RemoteProtocol::OneDrive,
        "svn" | "subversion" => RemoteProtocol::Subversion,
        other => {
            return Err(RemoteProviderError::InvalidPath(format!(
                "unknown remote scheme: {other}"
            )))
        }
    };

    let rest = rest.trim_start_matches('/');
    let mut parts = rest.splitn(3, '/');
    let first = parts.next().unwrap_or_default();
    let second = parts.next().unwrap_or_default();
    let remainder = parts.next().unwrap_or_default();

    if first.eq_ignore_ascii_case("profile") {
        if second.is_empty() {
            return Err(RemoteProviderError::InvalidPath(
                "remote URI is missing a profile id".to_owned(),
            ));
        }

        return Ok(RemoteUri {
            protocol,
            profile_ref: second.to_owned(),
            remote_path: if remainder.is_empty() {
                "/".to_owned()
            } else {
                format!("/{remainder}")
            },
        });
    }

    if first.is_empty() {
        return Err(RemoteProviderError::InvalidPath(
            "remote URI is missing a profile id".to_owned(),
        ));
    }

    Ok(RemoteUri {
        protocol,
        profile_ref: first.to_owned(),
        remote_path: if second.is_empty() {
            "/".to_owned()
        } else if remainder.is_empty() {
            format!("/{second}")
        } else {
            format!("/{second}/{remainder}")
        },
    })
}

pub fn format_remote_uri(protocol: RemoteProtocol, profile_ref: &str, remote_path: &str) -> String {
    let scheme = match protocol {
        RemoteProtocol::Ftp => "ftp",
        RemoteProtocol::Ftps => "ftps",
        RemoteProtocol::Sftp => "sftp",
        RemoteProtocol::WebDav => "webdav",
        RemoteProtocol::S3 => "s3",
        RemoteProtocol::Dropbox => "dropbox",
        RemoteProtocol::OneDrive => "onedrive",
        RemoteProtocol::Subversion => "svn",
    };
    let path = remote_path.trim_start_matches('/');

    if path.is_empty() {
        format!("{scheme}://profile/{profile_ref}")
    } else {
        format!("{scheme}://profile/{profile_ref}/{path}")
    }
}

pub fn is_remote_uri(value: &str) -> bool {
    parse_remote_uri(value).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_profile_based_sftp_uri() {
        let uri = parse_remote_uri("sftp://profile/prod-sftp/deployments/app.txt").unwrap();

        assert_eq!(uri.protocol, RemoteProtocol::Sftp);
        assert_eq!(uri.profile_ref, "prod-sftp");
        assert_eq!(uri.remote_path, "/deployments/app.txt");
    }

    #[test]
    fn parses_short_profile_uri() {
        let uri = parse_remote_uri("ftp://release-ftp/pub").unwrap();

        assert_eq!(uri.protocol, RemoteProtocol::Ftp);
        assert_eq!(uri.profile_ref, "release-ftp");
        assert_eq!(uri.remote_path, "/pub");
    }

    #[test]
    fn formats_profile_uri_without_logging_secrets() {
        assert_eq!(
            format_remote_uri(RemoteProtocol::Sftp, "prod-sftp", "/var/app"),
            "sftp://profile/prod-sftp/var/app"
        );
    }

    #[test]
    fn parses_and_formats_webdav_profile_uris() {
        let uri = parse_remote_uri("webdav://profile/team-webdav/shared/docs").unwrap();

        assert_eq!(uri.protocol, RemoteProtocol::WebDav);
        assert_eq!(uri.profile_ref, "team-webdav");
        assert_eq!(uri.remote_path, "/shared/docs");
        assert_eq!(
            format_remote_uri(RemoteProtocol::WebDav, "team-webdav", "/shared/docs"),
            "webdav://profile/team-webdav/shared/docs"
        );
        assert!(is_remote_uri("dav://profile/team-webdav/"));
    }
}
