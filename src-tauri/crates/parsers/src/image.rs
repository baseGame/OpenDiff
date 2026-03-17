use anyhow::Result;

pub struct ImageData {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>, // RGBA pixels, row-major
}

/// Decode an image file into raw RGBA pixels
pub fn extract_image_pixels(path: &std::path::Path) -> Result<ImageData> {
    let img = image::open(path)?.to_rgba8();
    let (w, h) = img.dimensions();
    Ok(ImageData { width: w, height: h, rgba: img.into_raw() })
}
