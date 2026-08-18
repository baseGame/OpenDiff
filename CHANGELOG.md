# Changelog

All notable changes to Open Diff will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic
Versioning for release tags.

## [Unreleased]

## [1.1.0] - 2026-08-18

### Added

- Text merge wired, ignore rules, real picture compare, table TSV/Excel,
  reports, and child folder open.
- Real ZIP/TAR compare (not a hex-tab fake), script runner, SFTP/FTP, patch
  apply, sync overrides, and git/svn `--write`.
- WebDAV, more script file ops, folder criteria, follow-system theme, and
  policy at startup.
- TypeScript 5.9.3 quality gate and a real `shell-compare` implementation.

### Changed

- Empty Open no longer seeds demo data.
- Open With and Align With stay unimplemented and report that honestly.
- `merge-text` requires `--automerge`.

### Tests

- UI↔command linkage coverage for shipped features.
- 100 consecutive greens for unit, cargo, and e2e.

### Known limitations

- Still unimplemented: S3, Dropbox, OneDrive, SVN, 7z, and live registry off
  Windows.

[Unreleased]: https://github.com/kygo8/open-diff/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/kygo8/open-diff/compare/v1.0.1...v1.1.0
