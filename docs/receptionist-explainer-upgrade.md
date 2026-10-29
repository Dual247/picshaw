# AI receptionist: explainer-led page and transparent pricing

The upgrade keeps the existing offer and founding-pilot status. It does not activate a Vapi assistant, change phone routing, modify payment plans or create a paid subscription. Published offer remains $399/month + $500 setup, 500 minutes per month, and $0.50/additional minute, before applicable extras/taxes. $899 is setup plus the first base month, not a claim about billing dates. Monthly examples: 750 minutes $524; 1,000 minutes $649. Contract/cancellation/billing details are still confirmed in the proposal, not invented by the calculator.

## Media
Original 1280x720 H.264 MP4, 42 seconds, with no audio stream, plus JPEG poster and six English WebVTT scene descriptions. Self-hosted; no external video provider, model call, additional tracking, autoplay or loop. The native player loads the MP4 on interaction (preload none). The full six-scene text alternative is in a native details element and is available without JavaScript.

The sample is prominently labelled illustrative, silent and not a live call. It shows the conceptual call-to-request workflow using fictional caller Alex in Culver City; it does not demonstrate actual voice quality, verified latency, a live Vapi integration or an already completed booking. There is no simulated 'call now' line. A real voice demonstration requires a configured assistant and an authorised, consented recording before publishing, rather than passing this illustration off as an actual system output.

The renderer is scripts/render-receptionist-explainer.py. Run in a Linux environment with Pillow 12.3.0, ffmpeg/libx264 and DejaVu fonts, then review generated files in public/media. A one-off branch-only GitHub workflow generated the initial assets and was removed before merging; no ongoing content-write workflow is installed by this upgrade. Do not include font files in downloadable assets.

## Validation
The dedicated workflow checks shared-offer calculations, actual MP4 stream/duration/size, captions, build/types/lint, native video playback, no autoplay or eager MP4 load, calculator keyboard operation, mobile overflow, text alternative, metadata and screenshots. Existing search/brand tests separately check the unchanged demo-enquiry flow and FAQ. Tests use localhost with third-party requests intercepted; no real emails, calls or Google events are sent.

Accessibility reference: https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded
Future genuine recording reference: https://docs.vapi.ai/assistants/retrieve-call-artifacts
