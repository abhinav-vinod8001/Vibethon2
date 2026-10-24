# fontkit 2.0.4: optional OpenType anchors

PDFKit uses fontkit to shape text. Upstream fontkit 2.0.4 attempts to dereference legal NULL GPOS anchors in Noto Sans Malayalam, failing resume export for normal Malayalam vowel marks.

The small version-pinned patch skips attachment when an anchor is absent. Non-NULL anchor positioning and other shaping features remain enabled. Source and packaged runtime builds receive the same guard; pnpm records and verifies the patch in the lockfile. The dependency stage of the Dockerfile copies patches before installation.

Upstream issue and reproducer: https://github.com/foliojs/fontkit/issues/367

Specification: https://learn.microsoft.com/en-us/typography/opentype/spec/gpos#mark-to-base-attachment-positioning

The Malayalam integration fixture exercises the affected layout. Remove this patch when the upstream fix is released, after rechecking rendered Malayalam text and the PDF integration tests.
