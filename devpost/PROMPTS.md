# Prompt log: how each build round was started

How this Lens was built:
- I chose the idea from my own research. My plan-lens answers were drafted at my request by my planning chat (a Claude Code session on my Mac) from that research, and I approved them: "I approve it. I give you full access and full permission to do it and go ahead."
- My final sign-off ("Use 62 cm demo target and add the slider fallback. looks good") was my instruction, and my planning chat pasted it into the builder chat for me.
- The build ran in a Claude Code chat on my Windows PC with CLAD and the Lens Studio MCP (the "builder chat").
- The build prompts below were written by my planning chat from my decisions and pasted into the builder chat over a remote-desktop connection. Each one starts with "From Stephen's Mac orchestrator Claude", so it's clear they weren't typed by me.

Times are Eastern, 2 November 2026. `devpost/BUILD_LOG.md` has one row per CLAD session.

| Time | What it asked for |
|---|---|
| 01:01 to 01:22 | Setup: check what's installed, install Lens Studio 5.23.2 and the Devpost Learn skill pack, open the project |
| 01:24 | `plan-lens`, with my approved answers; draft the brief and show it |
| 01:56 | My sign-off (above) |
| 02:29 | Geometry fixes checked against sources (the glare hit point must be on the glass), file-only until the LEAF permission prompt was accepted |
| 03:01 | Next pass: a "My eyes" preset that uses the viewer's real eye height |
| 03:26 to 03:29 | Decisions on two points the builder disagreed with (a tentative 3 m start), then clarity fixes from a five-second first-look test |
| 04:18 | A test-quality review of the LEAF suite by a fresh agent, with the gaps fixed |
| 06:07 and 06:42 | The remaining items: legend readability at every eye height, checks that use hand-computed values instead of the model |
| 08:35 | A fresh builder chat continuing from BUILD_LOG after the first one ran out of context |
| 09:42 | Retake four stills at v0.3.3, no other changes |
| 11:58 | Decisions made for me under my delegation on the open questions (keep the 3 m start, the floor shows the chosen eye height's zone) |
| 15:34 | v0.4: wall placement, unused packages removed, a fresh performance trace, cm and ft/in, a session log a stranger can recompute, README sections |
| 16:14 | v0.4 additions: "clear" only when all three eye heights are clear, before and after numbers per eye height, floor rings to step into, a shorter answer panel |

The full text of every prompt is in the local chat transcripts. The short descriptions above leave out operational notes (memory limits, status pings, file paths).
