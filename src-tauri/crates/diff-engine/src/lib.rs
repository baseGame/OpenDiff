pub mod algorithm;
pub mod types;
pub mod ignore;
pub mod char_diff;
pub mod file_diff;
pub mod merge;
#[cfg(test)]
mod tests;

pub use types::*;
pub use file_diff::diff_texts;
pub use merge::{merge_two, merge_three};
