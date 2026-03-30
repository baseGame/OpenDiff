//! Audio metadata tag parser — reads ID3v2 from MP3, Vorbis from FLAC
use anyhow::Result;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};

/// Extract audio metadata from MP3 or FLAC file
pub fn parse_audio_tags(path: &str) -> Result<AudioMetadata> {
    let mut file = BufReader::new(File::open(path)?);

    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut meta = AudioMetadata {
        title: None,
        artist: None,
        album: None,
        year: None,
        track_number: None,
        genre: None,
        duration_secs: 0,
        bitrate: None,
        sample_rate: None,
        channels: None,
    };

    match ext.as_str() {
        "mp3" => {
            if let Some(tags) = read_id3v2(&mut file)? {
                meta.title  = tags.get("TIT2").cloned();
                meta.artist = tags.get("TPE1").cloned();
                meta.album  = tags.get("TALB").cloned();
                meta.genre  = tags.get("TCON").cloned();
                if let Some(ty) = tags.get("TYER").or_else(|| tags.get("TDRC")) {
                    meta.year = ty.parse().ok();
                }
                if let Some(trk) = tags.get("TRCK") {
                    meta.track_number = trk.split('/').next().and_then(|s| s.parse().ok());
                }
            }
            if meta.title.is_none() {
                if let Ok(mut f) = File::open(path) {
                    f.seek(SeekFrom::End(-128))?;
                    let mut buf = [0u8; 128];
                    if f.read(&mut buf)? == 128 && &buf[0..3] == b"TAG" {
                        meta.title  = bytes_to_string(&buf[3..33]);
                        meta.artist = bytes_to_string(&buf[33..63]);
                        meta.album  = bytes_to_string(&buf[63..93]);
                        meta.year   = bytes_to_string(&buf[93..97]).and_then(|s| s.trim().parse().ok());
                    }
                }
            }
        }
        "flac" => {
            if let Ok(flac_meta) = read_flac_metadata(path) {
                meta.title  = flac_meta.title;
                meta.artist = flac_meta.artist;
                meta.album  = flac_meta.album;
                meta.year   = flac_meta.year;
            }
        }
        _ => {}
    }

    if let Ok(metadata) = std::fs::metadata(path) {
        let size_bytes = metadata.len();
        let estimated_secs = (size_bytes * 8) / 128_000;
        if estimated_secs > 0 {
            meta.duration_secs = estimated_secs;
        }
    }

    Ok(meta)
}

fn bytes_to_string(bytes: &[u8]) -> Option<String> {
    let s = String::from_utf8_lossy(bytes);
    let trimmed = s.trim_end();
    if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
}

fn read_id3v2<R: Read>(f: &mut R) -> Result<Option<std::collections::HashMap<String, String>>> {
    let mut buf = [0u8; 10];
    if f.read(&mut buf)? != 10 { return Ok(None); }
    if &buf[0..3] != b"ID3" { return Ok(None); }

    let size = ((buf[6] as usize) << 21)
        | ((buf[7] as usize) << 14)
        | ((buf[8] as usize) << 7)
        | (buf[9] as usize);
    let mut data = vec![0u8; size];
    f.read_exact(&mut data)?;

    let mut tags = std::collections::HashMap::new();
    let mut i = 0;
    while i + 10 < data.len() {
        let frame_id = String::from_utf8_lossy(&data[i..i+4]).to_string();
        if frame_id == "\0\0\0\0" { break; }
        let frame_sz = ((data[i+4] as usize) << 24)
            | ((data[i+5] as usize) << 16)
            | ((data[i+6] as usize) << 8)
            | (data[i+7] as usize);
        if frame_sz == 0 || i + 10 + frame_sz > data.len() { break; }
        let value = String::from_utf8_lossy(&data[i+11..i+11+frame_sz-1]).to_string();
        if !value.is_empty() { tags.insert(frame_id, value); }
        i += 10 + frame_sz;
    }

    Ok(Some(tags))
}

fn read_flac_metadata(path: &str) -> Result<FlacMeta> {
    let data = std::fs::read(path)?;
    if &data[0..4] != b"fLaC" { return Err(anyhow::anyhow!("Not a FLAC file")); }
    let mut meta = FlacMeta::default();
    let mut i = 4;
    while i < data.len() {
        let hdr = data[i];
        let is_last = (hdr >> 7) != 0;
        let block_type = hdr & 0x7F;
        let block_len = ((data[i+1] as usize) << 16)
            | ((data[i+2] as usize) << 8)
            | (data[i+3] as usize);
        i += 4;
        if block_type == 4 {
            let comment_data = &data[i..i+block_len];
            let mut pos = 0;
            let _vendor = read_flac_string(comment_data, &mut pos);
            let comment_list_len = read_flac_u32_le(comment_data, &mut pos) as usize;
            for _ in 0..comment_list_len {
                let key = read_flac_string(comment_data, &mut pos);
                let val = read_flac_string(comment_data, &mut pos);
                match key.to_uppercase().as_str() {
                    "TITLE"  => meta.title  = Some(val),
                    "ARTIST" => meta.artist = Some(val),
                    "ALBUM"  => meta.album  = Some(val),
                    "DATE" | "YEAR" => meta.year = val.parse().ok(),
                    _ => {}
                }
            }
        }
        if is_last { break; }
        i += block_len;
    }
    Ok(meta)
}

fn read_flac_string(data: &[u8], pos: &mut usize) -> String {
    let len = read_flac_u32_le(data, pos) as usize;
    if *pos + len > data.len() { return String::new(); }
    let s = String::from_utf8_lossy(&data[*pos..*pos+len]).to_string();
    *pos += len;
    s
}

fn read_flac_u32_le(data: &[u8], pos: &mut usize) -> u32 {
    let a = data[*pos] as u32;
    let b = data[*pos+1] as u32;
    let c = data[*pos+2] as u32;
    let d = data[*pos+3] as u32;
    let v = (a << 24) | (b << 16) | (c << 8) | d;
    *pos += 4;
    v
}

#[derive(Default)]
struct FlacMeta {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<u32>,
}

#[derive(Debug, serde::Serialize)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub genre: Option<String>,
    pub duration_secs: u64,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
}
