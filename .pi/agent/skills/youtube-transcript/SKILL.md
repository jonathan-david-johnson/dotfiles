---
description: Extract clean, timestamped transcripts from YouTube videos using yt-dlp — no API keys required.
---

# YouTube Transcript Extraction

Extract clean, timestamped transcripts from YouTube videos using `yt-dlp` — no API keys required.

## Default Path (Always Start Here)

**Use yt-dlp first. Always.** It requires zero API keys, works on virtually every YouTube video with captions, and is reliable. Do not parallelize with fetch_content — yt-dlp alone is the default.

## When to Use

- User asks for a YouTube video transcript
- User wants to read/analyze what was said in a video
- User wants to search or quote specific parts of a video
- User provides a YouTube URL and asks about its content

## Requirements

- `yt-dlp` installed (`brew install yt-dlp`)
- YouTube video has auto-generated or manual subtitles (most do)

## Workflow

### 1. Check Available Subtitles

```bash
yt-dlp --list-subs "VIDEO_URL" 2>&1 | head -20
```

Look for `en` (English) or `en-orig` (English original) in the output.

### 2. Download Transcript

**SRT format (recommended — clean, readable, timestamped):**
```bash
yt-dlp --write-auto-sub --sub-lang en --sub-format srt --skip-download -o "/tmp/yt_transcript" "VIDEO_URL"
```

**VTT format (if SRT unavailable):**
```bash
yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-sub vtt -o "/tmp/yt_transcript" "VIDEO_URL"
```

### 3. Read the Transcript

The output file will be at `/tmp/yt_transcript.en.srt` (or `.vtt`).

**SRT format structure:**
```
1
00:00:00,080 --> 00:00:03,200
First line of dialogue.

2
00:00:01,600 --> 00:00:05,200
Second line of dialogue.
```

Note: SRT segments overlap in time (each line starts before the previous one ends). To read chronologically, follow the sequence numbers — each new number continues the conversation.

### 4. Extract Video Metadata (Optional)

```bash
yt-dlp --print title --print duration --print channel "VIDEO_URL"
```

## Speaker Identification

- `>>` indicates a speaker change (usually the interviewer)
- `[ __ ]` indicates censored profanity in auto-generated captions
- `uh`, `um` are filler words captured by auto-captions

## Limitations

- Auto-generated captions may have errors, especially with technical terms, names, or accents
- Videos without any subtitles (rare) can't be transcribed this way
- No visual context — only audio transcription
- Overlapping speech may be garbled

## Alternative: Gemini Video Understanding (Secondary — Not for Transcripts)

**Only use this when:**
1. You need visual analysis (screenshots, code on screen, diagrams in the video), OR
2. yt-dlp failed to find subtitles for the video

**AND** you've verified `GEMINI_API_KEY` is set (check `~/.pi/web-search.json` or environment). Do not attempt this without confirming the key exists first.

```
fetch_content({
  url: "VIDEO_URL",
  prompt: "Summarize this video and extract the full transcript with timestamps."
})
```

Requires `GEMINI_API_KEY` in environment or `~/.pi/web-search.json`. If the key is missing and yt-dlp already produced a transcript, stop here — do not try fetch_content.

## Quick Reference

| Format | Command | Best For |
|--------|---------|----------|
| SRT | `--sub-format srt` | Clean reading, timestamps |
| VTT | `--convert-sub vtt` | Fallback if SRT unavailable |
| JSON3 | `--sub-format json3` | Programmatic parsing |
| Plain text | `--write-auto-sub --sub-lang en --skip-download --convert-sub txt` | Raw text only |
