use crate::{SessionManager, SessionKind, AppSettings};
use tempfile::tempdir;

fn rt() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap()
}

#[test]
fn test_session_crud() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempdir().unwrap();
        let mgr = SessionManager::new(dir.path()).await.unwrap();

        // Create session
        let s = SessionManager::new_session(
            SessionKind::TextDiff,
            "/tmp/left.txt".to_string(),
            "/tmp/right.txt".to_string(),
        );
        let id = s.id.clone();
        mgr.save_session(&s).await.unwrap();

        // Read back
        let loaded = mgr.get_session(&id).await.unwrap().unwrap();
        assert_eq!(loaded.left_path, "/tmp/left.txt");
        assert_eq!(loaded.right_path, "/tmp/right.txt");

        // List recent
        let recent = mgr.list_recent(10).await.unwrap();
        assert!(!recent.is_empty());

        // Delete
        mgr.delete_session(&id).await.unwrap();
        let gone = mgr.get_session(&id).await.unwrap();
        assert!(gone.is_none());
    });
}

#[test]
fn test_settings_persistence() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempdir().unwrap();
        let mgr = SessionManager::new(dir.path()).await.unwrap();

        let mut s = mgr.get_settings().await.unwrap();
        s.font_size = 16;
        s.show_whitespace = true;
        mgr.save_settings(&s).await.unwrap();

        let loaded = mgr.get_settings().await.unwrap();
        assert_eq!(loaded.font_size, 16);
        assert!(loaded.show_whitespace);
    });
}

#[test]
fn test_multiple_sessions_list_order() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempdir().unwrap();
        let mgr = SessionManager::new(dir.path()).await.unwrap();

        for i in 0..5 {
            let s = SessionManager::new_session(
                SessionKind::FolderDiff,
                format!("/left{i}"),
                format!("/right{i}"),
            );
            mgr.save_session(&s).await.unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }

        let recent = mgr.list_recent(3).await.unwrap();
        assert_eq!(recent.len(), 3);
        // Most recent should be first
        assert!(recent[0].left_path.contains("4") || recent[0].last_opened >= recent[1].last_opened);
    });
}
