//! Image diff command — generates pixel-level diff PNG
use image::{ImageBuffer, Rgba, RgbaImage, ImageEncoder};
use parsers::image::extract_image_pixels;
use std::path::Path;

#[tauri::command]
pub async fn cmd_diff_images(
    left_path: String,
    right_path: String,
    threshold: Option<u32>,
) -> Result<String, String> {
    let threshold = threshold.unwrap_or(10) as f32;

    let left  = extract_image_pixels(Path::new(&left_path))
        .map_err(|e| e.to_string())?;
    let right = extract_image_pixels(Path::new(&right_path))
        .map_err(|e| e.to_string())?;

    let w = left.width.max(right.width);
    let h = left.height.max(right.height);

    let mut diff_img: RgbaImage = ImageBuffer::from_pixel(w, h, Rgba([0, 0, 0, 0]));

    for y in 0..h {
        for x in 0..w {
            let get_pixel = |rgba: &[u8], w: u32, h: u32| -> [u8; 4] {
                if x < w && y < h {
                    let idx = ((y * w + x) * 4) as usize;
                    [rgba[idx], rgba[idx+1], rgba[idx+2], rgba[idx+3]]
                } else { [0,0,0,0] }
            };
            let lp = get_pixel(&left.rgba,  left.width,  left.height);
            let rp = get_pixel(&right.rgba, right.width, right.height);

            let dr = (lp[0] as f32 - rp[0] as f32).abs();
            let dg = (lp[1] as f32 - rp[1] as f32).abs();
            let db = (lp[2] as f32 - rp[2] as f32).abs();
            let da = (lp[3] as f32 - rp[3] as f32).abs();

            let total = dr + dg + db;
            if total > threshold * 3.0 || da > threshold {
                diff_img.put_pixel(x, y, Rgba([
                    (dr * 4.0).min(255.0) as u8,
                    (dg * 4.0).min(255.0) as u8,
                    (db * 4.0).min(255.0) as u8,
                    200,
                ]));
            }
        }
    }

    let mut buf = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut buf);
        encoder.write_image(&diff_img, w, h, image::ExtendedColorType::Rgba8)
            .map_err(|e: image::ImageError| e.to_string())?;
    }

    Ok(format!("data:image/png;base64,{}", base64_encode(&buf)))
}

fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;
        result.push(ALPHABET[b0 >> 2] as char);
        result.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        result.push(if chunk.len() > 1 { ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char } else { '=' });
        result.push(if chunk.len() > 2 { ALPHABET[b2 & 0x3f] as char } else { '=' });
    }
    result
}
