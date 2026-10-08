# Brand and showcase assets

Updated 2026-10-08.

## Picshaw brand mark

`public/brand/picshaw-mark.svg` is the supplied `picshaw_p_hat_brand_mark.svg` from the logo conversation: charcoal circle, ivory P, and warm paper-hat facets. No geometry or palette was redrawn. The viewBox is cropped to the circle's existing bounds (88, 88, 848, 848) so the mark is legible in the header. `app/icon.svg` uses the same artwork; the obsolete `app/icon.png` is removed to avoid competing favicons. The header and footer share `BrandLogo`.

## Showcase photography

The showcase is an illustrative portfolio of design concepts. These compositions are not screenshots of live client sites, the stock photographs do not show the named businesses, and the portrait is not a client, patient, testimonial, treatment result, or endorsement. Do not describe them as completed or measured client work. Existing destination and evidence gates remain intact.

Sources (listed as free under the Unsplash License on the source pages):

- Pacific concept: Steven Ungermann, white ceramic sink with mirror. https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI — `photo-1629079447777-1e605162dc8d`.
- Glow concept: Fleur Kaan, natural-light portrait. https://unsplash.com/photos/woman-in-white-tank-top-w4Dj3MshHQ0 — `photo-1581182800629-7d90925ad072`.
- Ember concept: Kayleigh Harrington, restaurant interior. https://unsplash.com/photos/group-of-people-inside-the-restaurant-yhn4okt6ci0 — `photo-1508424757105-b6d5ad9329d0`.

Source links are also visible in the website captions. Photos are served by the Unsplash image CDN with explicit width/quality parameters, not a random image endpoint. Browser loading is lazy, and each preview has a fixed aspect ratio and a colour fallback if a photograph is unavailable. Presentation text and mock navigation are deliberately non-interactive; the real contact CTA sits outside the composition.

The existing site colour tokens remain unchanged: near-black background, off-white text, vermilion primary, and warm gold accent. Each concept uses a restrained, industry-appropriate palette inside its frame.
