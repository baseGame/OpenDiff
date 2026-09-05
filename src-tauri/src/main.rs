#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if open_diff_app_lib::prepare_shell_startup(std::env::args())
        == open_diff_app_lib::ShellStartupDecision::ExitQuiet
    {
        return;
    }

    open_diff_app_lib::run();
}
