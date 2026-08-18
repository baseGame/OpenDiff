use crate::{
    CredentialReference, CredentialReferenceKind, RemoteCredential, RemoteEndpoint, RemoteProfile,
    RemoteProtocol, SecretString,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProfileStoreError {
    Io(String),
    Serialize(String),
}

pub type ProfileStoreResult<T> = Result<T, ProfileStoreError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
struct StoredProfileDocument {
    profiles: Vec<RemoteProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
struct StoredSecretDocument {
    secrets: BTreeMap<String, StoredSecret>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct StoredSecret {
    username: Option<String>,
    password: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteProfileStore {
    profiles_path: PathBuf,
    secrets_path: PathBuf,
}

impl RemoteProfileStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        let root = root.into();
        Self {
            profiles_path: root.join("remote-profiles.json"),
            secrets_path: root.join("remote-secrets.json"),
        }
    }

    pub fn profiles_path(&self) -> &Path {
        &self.profiles_path
    }

    pub fn secrets_path(&self) -> &Path {
        &self.secrets_path
    }

    pub fn load_profiles(&self) -> ProfileStoreResult<Vec<RemoteProfile>> {
        if !self.profiles_path.exists() {
            return Ok(Vec::new());
        }

        let bytes = fs::read(&self.profiles_path).map_err(io_error)?;
        let document = serde_json::from_slice::<StoredProfileDocument>(&bytes)
            .map_err(|error| ProfileStoreError::Serialize(error.to_string()))?;

        Ok(document.profiles)
    }

    pub fn save_profiles(&self, profiles: &[RemoteProfile]) -> ProfileStoreResult<()> {
        if let Some(parent) = self.profiles_path.parent() {
            fs::create_dir_all(parent).map_err(io_error)?;
        }

        let bytes = serde_json::to_vec_pretty(&StoredProfileDocument {
            profiles: profiles.to_vec(),
        })
        .map_err(|error| ProfileStoreError::Serialize(error.to_string()))?;
        fs::write(&self.profiles_path, bytes).map_err(io_error)?;
        restrict_file_permissions(&self.profiles_path);

        Ok(())
    }

    pub fn upsert_profile(&self, profile: RemoteProfile) -> ProfileStoreResult<Vec<RemoteProfile>> {
        let mut profiles = self.load_profiles()?;
        if let Some(existing) = profiles.iter_mut().find(|item| item.id == profile.id) {
            *existing = profile;
        } else {
            profiles.push(profile);
        }
        self.save_profiles(&profiles)?;
        Ok(profiles)
    }

    pub fn delete_profile(&self, profile_id: &str) -> ProfileStoreResult<Vec<RemoteProfile>> {
        let mut profiles = self.load_profiles()?;
        profiles.retain(|profile| profile.id != profile_id);
        self.save_profiles(&profiles)?;
        self.delete_secret(profile_id)?;
        Ok(profiles)
    }

    pub fn find_profile(&self, profile_ref: &str) -> ProfileStoreResult<Option<RemoteProfile>> {
        Ok(self.load_profiles()?.into_iter().find(|profile| {
            profile.id == profile_ref || profile.name.eq_ignore_ascii_case(profile_ref)
        }))
    }

    pub fn save_secret(
        &self,
        profile_id: &str,
        username: Option<&str>,
        password: &str,
    ) -> ProfileStoreResult<()> {
        let mut document = self.load_secrets_document()?;
        document.secrets.insert(
            profile_id.to_owned(),
            StoredSecret {
                username: username.map(str::to_owned),
                password: password.to_owned(),
            },
        );
        self.write_secrets_document(&document)
    }

    pub fn load_secret(&self, profile_id: &str) -> ProfileStoreResult<Option<RemoteCredential>> {
        let document = self.load_secrets_document()?;
        Ok(document
            .secrets
            .get(profile_id)
            .map(|secret| RemoteCredential {
                username: secret.username.clone(),
                material: crate::RemoteCredentialMaterial::Password(SecretString::new(
                    secret.password.clone(),
                )),
            }))
    }

    pub fn delete_secret(&self, profile_id: &str) -> ProfileStoreResult<()> {
        let mut document = self.load_secrets_document()?;
        document.secrets.remove(profile_id);
        self.write_secrets_document(&document)
    }

    fn load_secrets_document(&self) -> ProfileStoreResult<StoredSecretDocument> {
        if !self.secrets_path.exists() {
            return Ok(StoredSecretDocument::default());
        }

        let bytes = fs::read(&self.secrets_path).map_err(io_error)?;
        serde_json::from_slice(&bytes)
            .map_err(|error| ProfileStoreError::Serialize(error.to_string()))
    }

    fn write_secrets_document(&self, document: &StoredSecretDocument) -> ProfileStoreResult<()> {
        if let Some(parent) = self.secrets_path.parent() {
            fs::create_dir_all(parent).map_err(io_error)?;
        }

        let bytes = serde_json::to_vec_pretty(document)
            .map_err(|error| ProfileStoreError::Serialize(error.to_string()))?;
        fs::write(&self.secrets_path, bytes).map_err(io_error)?;
        restrict_file_permissions(&self.secrets_path);
        Ok(())
    }
}

pub fn default_profile(id: impl Into<String>, name: impl Into<String>) -> RemoteProfile {
    let id = id.into();
    RemoteProfile::new(
        id.clone(),
        name,
        RemoteProtocol::Sftp,
        RemoteEndpoint::new("").with_port(22).with_root_path("/"),
        CredentialReference {
            kind: CredentialReferenceKind::ProfileStore,
            key: id,
        },
    )
}

fn io_error(error: std::io::Error) -> ProfileStoreError {
    ProfileStoreError::Io(error.to_string())
}

fn restrict_file_permissions(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(path) {
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o600);
            let _ = fs::set_permissions(path, permissions);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_profiles_without_plaintext_passwords() {
        let root = unique_temp_dir("remote-store");
        let store = RemoteProfileStore::new(&root);
        let profile = default_profile("prod-sftp", "Production SFTP");

        store.upsert_profile(profile.clone()).unwrap();
        store
            .save_secret("prod-sftp", Some("deploy"), "correct-horse")
            .unwrap();

        let loaded = store.load_profiles().unwrap();
        let json = std::fs::read_to_string(store.profiles_path()).unwrap();
        let secret = store.load_secret("prod-sftp").unwrap().unwrap();

        assert_eq!(loaded, vec![profile]);
        assert!(!json.contains("correct-horse"));
        assert!(!json.contains("password"));
        assert_eq!(secret.username.as_deref(), Some("deploy"));
        assert_eq!(secret.secret().expose_secret(), "correct-horse");

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn finds_profiles_by_id_or_name() {
        let root = unique_temp_dir("remote-find");
        let store = RemoteProfileStore::new(&root);
        store
            .upsert_profile(default_profile("prod-sftp", "Production SFTP"))
            .unwrap();

        assert_eq!(
            store.find_profile("prod-sftp").unwrap().unwrap().id,
            "prod-sftp"
        );
        assert_eq!(
            store.find_profile("Production SFTP").unwrap().unwrap().id,
            "prod-sftp"
        );

        let _ = std::fs::remove_dir_all(root);
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"));
        std::fs::create_dir_all(&path).expect("temp dir");
        path
    }
}
