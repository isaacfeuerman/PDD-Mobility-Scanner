# Trail Surface ID (Video) — YOLO26 + CLIP

Per-frame trail surface classification on an MP4, with post-hoc smoothing.

## What it does

For every frame of an uploaded video:

1. **YOLO26** instance segmentation picks the best trail-class mask (largest `area * confidence`).
2. The mask is **dilated** by `MASK_DILATE_PX` (default 20 px) so CLIP gets a little context around the trail edge.
3. Non-trail pixels are blacked out and the frame is cropped to the mask bbox.
4. **CLIP** (`openai/clip-vit-base-patch32`) scores the crop against a prompt set covering 8 surface categories (Gravel, Paved, Boardwalk, Bog Bridge, Rocky, Dirt, Woodchips, Grass).
5. Results are written per-frame to a CSV; an annotated MP4 is produced.

Per-frame predictions are jittery, so a centered confidence-weighted **rolling mean** is applied post-hoc and the smoothed label is what gets burned into the final video.

## Pipeline

| Step | Cell | Purpose |
|------|------|---------|
| 1 | install/import | `ultralytics`, `transformers`, `pillow`, `opencv` |
| 2 | upload weights | YOLO26 `.pt` weights (instance-seg model); load CLIP |
| 3 | prompt set | Maps prompt phrases → surface categories |
| 4 | helpers | `get_best_trail_mask`, `dilate_mask`, `masked_crop_for_clip`, `clip_classify_surface`, `overlay_mask_bgr` |
| 5 | upload video | Pick the `.mp4` to process |
| 6 | per-frame loop | Runs YOLO+CLIP, writes `output_masks.mp4` (mask overlay only, no labels) and `surface_per_frame.csv` |
| 7 | raw timeline | Label histogram + per-frame CLIP score plot |
| **7.5** | smoothing | Centered confidence-weighted rolling mean → re-derives label → burns smoothed text onto the mask video → produces `output.mp4` |
| 8 | downloads | `output.mp4`, `surface_per_frame.csv`, `surface_per_frame_smoothed.csv` |

## Smoothing model (Step 7.5)

For each frame *t* and each category score *s*:

```
smoothed_s[t] = sum(w[k] * s[k]) / sum(w[k])  for k in centered window of size N
where w[k] = max(yolo_conf[k], FALLBACK_WEIGHT)
N = round(SMOOTH_WINDOW_SEC * fps), forced odd
```

Frames where YOLO didn't find a trail mask still contribute, but at a small floor weight so they don't dominate. `clip_label_smoothed = argmax(smoothed_s)`.

## Tunables

| Constant | Default | Meaning |
|----------|---------|---------|
| `MASK_DILATE_PX` | 20 | Pixels to grow the trail mask before cropping for CLIP |
| `YOLO_TRAIL_MIN_CONF` | 0.25 | Min YOLO confidence to consider a detection |
| `TRAIL_CLASS_HINTS` | `["trail", "path", "sidewalk", "road"]` | Substring match for "trail-like" classes in the YOLO model's class list |
| `SMOOTH_WINDOW_SEC` | 2.0 | Centered smoothing window length in seconds |
| `FALLBACK_WEIGHT` | 0.1 | Weight floor for frames with no YOLO mask |
| `PROGRESS_EVERY` | 25 | Frames between progress prints in Step 6 |

## Inputs

- YOLO26 instance-segmentation weights (`.pt`)
- An `.mp4` video (any resolution / fps)

## Outputs

- `output.mp4` — mask overlay + smoothed surface label burned per frame
- `surface_per_frame.csv` — raw per-frame results: `frame, t_sec, yolo_class, yolo_conf, yolo_mask_area_px, clip_label, clip_conf_pct, used_fallback, score_<Category>...`
- `surface_per_frame_smoothed.csv` — same columns plus `score_<Category>_smoothed`, `clip_label_smoothed`, `clip_conf_smoothed_pct`

## Re-tuning the smoothing

Step 6 is the expensive one (per-frame YOLO + CLIP). Step 7.5 is cheap — change `SMOOTH_WINDOW_SEC`, re-run just that cell, and you get a new `output.mp4` and smoothed CSV without redoing inference. The mask-only `output_masks.mp4` is the cached intermediate that makes that possible.

## Notes

- Runs on GPU automatically when CUDA is available; falls back to CPU.
- Designed for Google Colab (uses `google.colab.files` for upload/download).
