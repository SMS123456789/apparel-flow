-- Deterministic reference data, delivered by migrations for cloud and local resets.
-- Replaying this seed is safe; a conflicting existing catalog is not overwritten.
INSERT INTO public.recipes (id, recipe_code, name, category, std_fabric_yards, wastage_cap_pct)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'REC-BL01', 'Casual Blouse', 'Blouse', 1.8, 5.0),
  ('10000000-0000-4000-8000-000000000002', 'REC-CT02', 'Crop Top', 'Crop Top', 1.1, 8.0)
ON CONFLICT (recipe_code) DO NOTHING;

INSERT INTO public.recipe_components (id, recipe_id, component_name, pieces_per_garment, sort_order)
SELECT component_id::uuid, recipe.id, component_name, pieces, position
FROM (VALUES
  ('20000000-0000-4000-8000-000000000001', 'REC-BL01', 'Front Body Panel', 1, 1),
  ('20000000-0000-4000-8000-000000000002', 'REC-BL01', 'Back Body Panel', 1, 2),
  ('20000000-0000-4000-8000-000000000003', 'REC-BL01', 'Sleeves (Left & Right)', 2, 3),
  ('20000000-0000-4000-8000-000000000004', 'REC-BL01', 'Collar & Stand', 1, 4),
  ('20000000-0000-4000-8000-000000000005', 'REC-BL01', 'Sleeve Cuffs', 2, 5),
  ('20000000-0000-4000-8000-000000000006', 'REC-CT02', 'Front Chest Panel', 1, 1),
  ('20000000-0000-4000-8000-000000000007', 'REC-CT02', 'Back Support Panel', 1, 2),
  ('20000000-0000-4000-8000-000000000008', 'REC-CT02', 'Neck Binding Strip', 1, 3),
  ('20000000-0000-4000-8000-000000000009', 'REC-CT02', 'Hem Elastic Casing', 1, 4),
  ('20000000-0000-4000-8000-000000000010', 'REC-CT02', 'Side Strap Accents', 2, 5)
) AS seed(component_id, recipe_code, component_name, pieces, position)
JOIN public.recipes recipe USING (recipe_code)
ON CONFLICT (recipe_id, component_name) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.recipes WHERE
    (recipe_code, name, category, std_fabric_yards, wastage_cap_pct) IN
    (('REC-BL01', 'Casual Blouse', 'Blouse', 1.8, 5.0), ('REC-CT02', 'Crop Top', 'Crop Top', 1.1, 8.0))) <> 2 THEN
    RAISE EXCEPTION 'Assessment recipe values conflict with the required catalog';
  END IF;
  IF (SELECT count(*) FROM public.recipe_components c JOIN public.recipes r ON r.id = c.recipe_id
      WHERE r.recipe_code IN ('REC-BL01', 'REC-CT02')) <> 10 THEN
    RAISE EXCEPTION 'Assessment recipes must contain exactly five components each';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('REC-BL01', 'Front Body Panel', 1, 1),
      ('REC-BL01', 'Back Body Panel', 1, 2),
      ('REC-BL01', 'Sleeves (Left & Right)', 2, 3),
      ('REC-BL01', 'Collar & Stand', 1, 4),
      ('REC-BL01', 'Sleeve Cuffs', 2, 5),
      ('REC-CT02', 'Front Chest Panel', 1, 1),
      ('REC-CT02', 'Back Support Panel', 1, 2),
      ('REC-CT02', 'Neck Binding Strip', 1, 3),
      ('REC-CT02', 'Hem Elastic Casing', 1, 4),
      ('REC-CT02', 'Side Strap Accents', 2, 5)
    ) AS required(recipe_code, component_name, pieces, position)
    LEFT JOIN public.recipes r USING (recipe_code)
    LEFT JOIN public.recipe_components c ON c.recipe_id = r.id AND c.component_name = required.component_name
    WHERE c.id IS NULL OR c.pieces_per_garment <> required.pieces OR c.sort_order <> required.position OR c.image_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Assessment component values conflict with the required BOM';
  END IF;
END;
$$;
