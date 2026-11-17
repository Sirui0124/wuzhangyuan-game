# G3 working state (2026-10-25, runtime recovery notes)

Scope: only groups/G3 and its supplemental reference images. Source/root controller chat: 01a16f08-4fed-7eb0-ac75-041e1f010683. Original assignment V21–V25. User authorized full generation/review/same-V assembly; no game/table/source edits.

Latest controller directions: prioritize visuals. No new TTS calls. Audio wrong words/voice/BGM are audioIssues, not paid-video reshoot triggers. Natural NPC speech performance still required; player-only stays listener. New NPC guide-only prompt may omit actual Chinese words but preserve full intended original lines/speaker/times in MD/JSON; never claim aligned lips/audio. Validate one real planned clip before extending.

Network incident: V24-03 explicitly failed input_download_failed/TLS, output_seconds=0. Independent V24-03-R2 was accepted before global pause and has succeeded; original state retained. No other video retries. All old tasks terminal.

Controller formally resumed POST using byte-verified res-1.cloudinary.com. Central adapter is ../../scripts/cloudinary_shard_transport.py; run_pipeline calls promote after prepare for new requests, never edits accepted/unknown state. Shared video_api remains unchanged.

Current executor: run_pipeline.py watch, exec session 33493, lock file holds PID. dispatch-allowlist.json permits only V25-02. Pilot accepted task_eqCzrMl4jGx4GDabMQxfDktmAbfUGlDX. Remaining six V25-03 through V25-08 have NOT been submitted. Wait for pilot to succeed, inspect actual movie via browser/dense frames. If no subtitles/new props and natural speaking performance, adapt remaining NPC prompts to same minimal English (no formal Chinese dialogue in API) and remove allowlist. Keep player-only prompts closed-lip. Continue <=6 in-flight, >=120 seconds per task poll; never retry uncertain.

27 prior usable subclips exist. Four assembled candidates complete:
- V21 98.88 s
- V22 55.253333 s
- V23 25.054333 s
- V24 77.749349 s
These four were decoded and browser-played fully (silent visual review) with 3fps full sequences and action/transition screenshots. Proof: review/assembled-browser-playback.json. V25-01 played separately but final ended UI should be recorded. All actualDynamicReview flags for V21–V24 set; audio not listened/approved.

Scripts:
- run_pipeline.py watch (persistent task IDs, six limit, 120s, allowlist/pause gate)
- postproduction.py (reads adopted paths, optional existing central TTS only if raw ASR verified no unintended speech; currently most raw audio remains for later dubbing; same-V assembly, V24 entry/exit dissolves, source coverage/tasks in delivery.json)
- make_delivery_doc.py (refresh 本组交付.md with all 35 independent MD links including R2)
- prepare_api_prompts.py rewrites only UNsubmitted local bodies; do not blindly rerun now because it would overwrite custom V25-02 pilot/body. Full build_plan.py also rewrites plan and local requests; do not rerun.
- apply_visual_fixes.py early batch helper; do NOT rerun: it would reset review flags and replace later V21-05 adopted color v4 path.
- review_audio.py is local faster-whisper auxiliary only, no listening claim; no need expand audio work in this visual phase.

Important adopted edits are in review/decisions.json. Originals and all edits retained. V21-05 final is visualcrop-color-v4 (feathered RGB mask desaturation of extra red shoulder spot, natural facial skin). Earlier v2/v3 color versions are NOT final. V24-03 uses successful R2 through postproduction revision selection. V24-02/04/05 cropped bottom generated subtitles; V24-03-R2 and 06 visually intact but Li Yan mouth / Gou An offscreen dialogue await unified audio/lip review, explicitly marked. V23 action cuts avoid repeating the bag-closing movement and retain enough room for full 5.392s inner voice. V22-06 cuts away a third-person shoulder section but retains warehouse establish + 6.75s officer frontal performance for the 20 Chinese characters.

References: central 15 images ready. G3 generated two own night lighting edits (same identity/pose) through authorized OpenAI Next gpt-image-2 adapter, ready in references/composition-manifest.json: gouan-night-prone, liyan-night-desk. No more images needed. Night V24/V25 uses single first_frame; no mixing reference_image with first_frame.

Browser visual QA: local HTTP server exec session 12588, 127.0.0.1:8933 serves only G3. CUA tab g3tab (IAB browser 2 tab 1) is review-player.html. Code supports ?clip=V25-01 and ?film=V24, has buttons 加载/采用片/播放 and silent continuous/assembled playback; records actual played ranges in UI. If CUA context compacted, call cua.rewriteDocumentation before continuing. Latest known page ?clip=V25-01, movie played manually. Browser work stays hidden/muted.

Final must not claim entire G3 complete until remaining seven/now-six slots actually generated/reviewed and V25 assembled. Outputs are visual production candidates, not user approval, not formal audio through. Deliver five playable MP4 paths, 本组交付.md/分镜脚本.md and delivery.json. No ZIP. Root will aggregate by reading state.
