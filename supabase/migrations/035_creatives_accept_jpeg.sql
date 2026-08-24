-- ═══════════════════════════════════════════════════════════════════════════
-- 035 — the creatives bucket accepts JPEG as well as PNG
--
-- 005 created this bucket for ONE producer: the content engine, which renders
-- its carousels itself and always emits PNG. So `allowed_mime_types` was
-- array['image/png'] and that was exactly right.
--
-- The social module is now a second producer, and its images do not come from
-- a renderer — a designer exports them. Figma, Photoshop and Canva all export
-- JPEG by default for photographic work, and Instagram's Graph API accepts
-- JPEG and PNG alike. Refusing JPEG would mean telling a designer to re-export
-- for a reason that exists nowhere outside this line.
--
-- The size limit stays at 10 MB: it is well past a 1080×1350 export and it is
-- the thing standing between a mis-drag and a 200 MB upload.
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg']
 where id = 'creatives';
