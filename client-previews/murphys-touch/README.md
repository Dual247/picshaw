# Murphy’s Touch — Picshaw website concept

An individual, public, temporary concept for Paul Murphy following his interested reply to Picshaw’s hotel furniture restoration introduction. The working preview is intended for `https://www.picshaw.com/previews/murphys-touch/`.

## Scope

The concept presents Murphy’s Touch’s hospitality restoration and residential/antique work using business-published facts and imagery. It is an independently prepared design for review, not the business’s official replacement site. The enquiry demonstration is local to the browser and must never send or persist customer data.

The follow-up offers the website, hosting and small updates at $250/month as a smaller, separate starting option. It does not reprice or include the entire $1,250/month, three-month visibility programme already sent in the existing email thread. Broader rankings, traffic, AI placements and lead results are not guaranteed or measured here.

## Source and contact

- Los Angeles: https://www.murphystouchla.com/ — Paul Murphy, paul@murphystouchla.com, (310) 268-8285.
- Desert Communities: https://www.murphystouch.com/ — same owner/email; (760) 656-4593.
- Both sites describe an apprenticeship in Farnham, Surrey; Paul’s move to Los Angeles in 1982; and the business’s founding in 1987.
- The 394-room Downtown LA renovation is described by a customer testimonial on the existing website. No hotel is named, and no photo may be presented as that project without additional evidence.
- Image and factual provenance are recorded in `docs/` and are excluded from the public output.

## Publication and expiration

Use the isolated Vercel project `picshaw-murphys-touch-preview` (`prj_7BftOcmw6dCLzHZoFFwdlBiAygCp`) in team `team_152cnGnh8Y1LacMEU6gvr5FJ`. Repository: `Dual247/picshaw`; operations branch: `preview/picshaw-outbound`; project root: `client-previews/murphys-touch`.

Set `preview-lifecycle.json` before the first deployment. Its fixed first-publication and expiry timestamps must never be reset on a redeploy. The period may not exceed 168 hours. `proxy.js` checks the server clock on every request, including all assets, before cache. At the cutoff it returns a neutral HTTP 410 page; active and expired responses use no-store headers. Invalid lifecycle configuration fails closed. Immutable deployment URLs retain deployment protection.

Only the two exact `www.picshaw.com/previews/murphys-touch` routes may be added to Picshaw’s routing project. Preserve all other routes. Save and verify a Gmail reply draft in the existing thread; sending and scheduling are not authorized.

`npm test` exercises the immutable cutoff and all-file/alias expiry policy. Browser QA checks desktop/mobile layout, navigation, service/gallery interaction and the local enquiry demonstration. Operational verification and email status belong in the central preview registry.
