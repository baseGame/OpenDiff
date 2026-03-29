use crate::{LocalVfs, Vfs, VPath};
use tokio::runtime::Runtime;
use std::io::Write;

fn rt() -> Runtime { tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap() }

#[test]
fn test_local_vfs_write_read() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempfile::tempdir().unwrap();
        let vfs = LocalVfs;
        let path = VPath::new(format!("{}/test.txt", dir.path().display()));
        vfs.write(&path, b"hello vfs\nline2").await.unwrap();
        let data = vfs.read_all(&path).await.unwrap();
        assert_eq!(data, b"hello vfs\nline2");
    });
}

#[test]
fn test_local_vfs_stat() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempfile::tempdir().unwrap();
        let vfs = LocalVfs;
        let path = VPath::new(format!("{}/stat_test.txt", dir.path().display()));
        vfs.write(&path, b"12345").await.unwrap();
        let meta = vfs.stat(&path).await.unwrap();
        assert_eq!(meta.size, Some(5));
        assert!(!meta.is_dir);
    });
}

#[test]
fn test_local_vfs_list() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempfile::tempdir().unwrap();
        let vfs = LocalVfs;
        let root = VPath::new(dir.path().display().to_string());
        // Create some files
        vfs.write(&root.join("a.txt"), b"A").await.unwrap();
        vfs.write(&root.join("b.txt"), b"B").await.unwrap();
        let entries = vfs.list(&root).await.unwrap();
        assert_eq!(entries.len(), 2);
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"a.txt"));
        assert!(names.contains(&"b.txt"));
    });
}

#[test]
fn test_local_vfs_mkdir_delete() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempfile::tempdir().unwrap();
        let vfs = LocalVfs;
        let sub = VPath::new(format!("{}/subdir/nested", dir.path().display()));
        vfs.mkdir(&sub).await.unwrap();
        assert!(std::path::Path::new(sub.as_str()).exists());
        let parent = VPath::new(format!("{}/subdir", dir.path().display()));
        vfs.delete(&parent, true).await.unwrap();
        assert!(!std::path::Path::new(sub.as_str()).exists());
    });
}

#[test]
fn test_local_vfs_rename() {
    let rt = rt();
    rt.block_on(async {
        let dir = tempfile::tempdir().unwrap();
        let vfs = LocalVfs;
        let src = VPath::new(format!("{}/old.txt", dir.path().display()));
        let dst = VPath::new(format!("{}/new.txt", dir.path().display()));
        vfs.write(&src, b"content").await.unwrap();
        vfs.rename(&src, &dst).await.unwrap();
        assert!(!std::path::Path::new(src.as_str()).exists());
        assert!(std::path::Path::new(dst.as_str()).exists());
    });
}

#[test]
fn test_vpath_operations() {
    let p = VPath::new("/home/user/documents/file.txt");
    assert_eq!(p.file_name(), "file.txt");
    assert_eq!(p.extension(), Some("txt"));
    let parent = p.parent().unwrap();
    assert_eq!(parent.as_str(), "/home/user/documents");
    let child = parent.join("other.rs");
    assert_eq!(child.as_str(), "/home/user/documents/other.rs");
}
