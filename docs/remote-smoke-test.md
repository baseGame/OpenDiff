# SFTP / FTP smoke test

Unit tests cover URI parsing, profile persistence (passwords stay out of `remote-profiles.json`), and a real TCP connect failure against `127.0.0.1:1`. They do not start a live SFTP or FTP daemon.

To smoke-test a live server:

1. Run the app or CLI with a writable config dir, for example `OPEN_DIFF_CONFIG_DIR=$PWD/.open-diff-config`.
2. Open **Settings → Remote Profiles**.
3. Create an **SFTP** or **FTP** profile (host, port, username, password). Other protocols stay labeled unimplemented and Test stays disabled.
4. Click **Save**, then **Test**. A success message must come from a real handshake plus a directory listing, not a queued/mock status.
5. Click **Browse remote** on the saved profile to list directories and pick a root path (credentials are not shown in the listing UI).
6. In Folder Compare, choose the profile or paste `sftp://profile/{id}/{remote-path}` (or `ftp://profile/{id}/{path}`) on one or both sides. With a profile selected, **Browse** opens the remote folder picker. Text Compare can load the same URI with **Load Files**; **Browse** on a remote URI path also lists remotely.
7. Confirm `remote-profiles.json` has no password, and `remote-secrets.json` is mode `0600` on Unix.

Passwords are never logged. There is no OS keyring in this build; secrets live only in that local file.
