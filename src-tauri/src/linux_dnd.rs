//! Linux/WebKitGTK desktop file-drop bridge.
//!
//! wry's built-in handler only emits `DragDropEvent::Drop` when its controller is already in
//! `Leaving` state and when `drag_data_received` used target info `== 2`. Thunar (and some other
//! file managers) often deliver URI lists with a different info index, or deliver the drop while
//! the controller is still `Entered`, so the JS `onDragDropEvent` listener never sees a `drop`.
//!
//! This bridge attaches after wry and accepts URI-list drops more permissively, then emits
//! `open-diff://desktop-drop` with absolute paths for the frontend.

#![cfg(target_os = "linux")]

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use gtk::gdk;
use gtk::prelude::*;
use tauri::{Emitter, Manager, Runtime, WebviewWindow};

pub const DESKTOP_DROP_EVENT: &str = "open-diff://desktop-drop";
pub const DESKTOP_DRAG_ENTER_EVENT: &str = "open-diff://desktop-drag-enter";
pub const DESKTOP_DRAG_LEAVE_EVENT: &str = "open-diff://desktop-drag-leave";

pub fn install_linux_desktop_drop_bridge<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let app = window.app_handle().clone();
    let window_label = window.label().to_string();

    window.with_webview(move |platform| {
        let webview = platform.inner();
        let pending_paths: Rc<RefCell<Option<Vec<String>>>> = Rc::new(RefCell::new(None));
        let drop_requested = Rc::new(Cell::new(false));
        let entered = Rc::new(Cell::new(false));

        {
            let pending_paths = pending_paths.clone();
            let drop_requested = drop_requested.clone();
            let entered = entered.clone();
            let app = app.clone();
            let window_label = window_label.clone();

            webview.connect_drag_data_received(move |_, ctx, _, _, data, _info, time| {
                let uris = data.uris();
                if uris.is_empty() {
                    return;
                }

                let paths = uris
                    .iter()
                    .map(|uri| uri_to_abs_path(uri.as_str()))
                    .filter(|path| !path.is_empty())
                    .collect::<Vec<_>>();

                if paths.is_empty() {
                    return;
                }

                if drop_requested.get() {
                    drop_requested.set(false);
                    entered.set(false);
                    pending_paths.borrow_mut().take();
                    ctx.drop_finish(true, time);
                    let _ = app.emit_to(window_label.as_str(), DESKTOP_DROP_EVENT, paths);
                    return;
                }

                if !entered.get() {
                    entered.set(true);
                    let _ = app.emit_to(
                        window_label.as_str(),
                        DESKTOP_DRAG_ENTER_EVENT,
                        paths.clone(),
                    );
                }

                *pending_paths.borrow_mut() = Some(paths);
            });
        }

        {
            let pending_paths = pending_paths.clone();
            let drop_requested = drop_requested.clone();
            let entered = entered.clone();
            let app = app.clone();
            let window_label = window_label.clone();

            webview.connect_drag_drop(move |widget, ctx, _x, _y, time| {
                if let Some(paths) = pending_paths.borrow_mut().take() {
                    entered.set(false);
                    drop_requested.set(false);
                    ctx.drop_finish(true, time);
                    let _ = app.emit_to(window_label.as_str(), DESKTOP_DROP_EVENT, paths);
                    return true;
                }

                // Data may arrive only after we accept the drop — request uri-list now.
                let target = widget
                    .drag_dest_find_target(ctx, None)
                    .unwrap_or_else(|| gdk::Atom::intern("text/uri-list"));

                drop_requested.set(true);
                widget.drag_get_data(ctx, &target, time);
                true
            });
        }

        {
            let pending_paths = pending_paths.clone();
            let drop_requested = drop_requested.clone();
            let entered = entered.clone();
            let app = app.clone();
            let window_label = window_label.clone();

            webview.connect_drag_leave(move |_, _, _| {
                if drop_requested.get() {
                    return;
                }

                // Defer leave so a following drop signal (common GTK ordering) still sees paths.
                let pending_paths = pending_paths.clone();
                let drop_requested = drop_requested.clone();
                let entered = entered.clone();
                let app = app.clone();
                let window_label = window_label.clone();
                gtk::glib::idle_add_local_once(move || {
                    if drop_requested.get() {
                        return;
                    }

                    if entered.get() {
                        entered.set(false);
                        pending_paths.borrow_mut().take();
                        let _ = app.emit_to(window_label.as_str(), DESKTOP_DRAG_LEAVE_EVENT, ());
                    }
                });
            });
        }
    })?;

    Ok(())
}

fn uri_to_abs_path(uri: &str) -> String {
    let stripped = uri.strip_prefix("file://").unwrap_or(uri);
    percent_decode(stripped)
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (from_hex(bytes[i + 1]), from_hex(bytes[i + 2])) {
                out.push((hi << 4) | lo);
                i += 3;
                continue;
            }
        }

        out.push(bytes[i]);
        i += 1;
    }

    String::from_utf8_lossy(&out).into_owned()
}

fn from_hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
