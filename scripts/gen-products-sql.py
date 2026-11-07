#!/usr/bin/env python3
"""site/products.json (exact sizes + photos from lldancestudio.dk/merchandise) → supabase/migrations/0013_products.sql (idempotent)."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "site", "products.json")))
q = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
arr = lambda xs: "array[" + ",".join(q(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"
out = ["-- 0013: shop products with the exact sizes and photos from lldancestudio.dk/merchandise; event.image_key for the image catalogue.",
       "alter table event add column if not exists image_key text;",
       "do $$ declare sid uuid := (select id from school where slug = 'llds'); begin"]
for i, p in enumerate(P):
    img = p["images"][0] if p["images"] else None
    out.append(f"insert into product(school_id, name, price_dkk, sizes, image_path, visibility, active) select sid, {q(p['name'])}, {p['price']}, {arr(p['sizes'])}, {q(img)}, 'public', true where not exists (select 1 from product x where x.school_id = sid and x.name = {q(p['name'])});")
    out.append(f"update product set price_dkk = {p['price']}, sizes = {arr(p['sizes'])}, image_path = coalesce(case when image_path like 'http%' or image_path is null then {q(img)} else image_path end, {q(img)}) where school_id = sid and name = {q(p['name'])};")
out.append("end $$;")
open(os.path.join(ROOT, "supabase", "migrations", "0013_products.sql"), "w").write("\n".join(out) + "\n"); print("wrote 0013_products.sql")
