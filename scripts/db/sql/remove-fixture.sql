-- Removes every row scripts/db/seed.ts's fixture path can have written, in
-- one statement: a single PL/pgSQL DO block, runnable as-is in psql or via
-- `npm run db:remove-fixture`. Identifies fixture rows the same way
-- scripts/checks/no-fixture-leak.ts does (franchise/category slug prefix
-- "fixture-", or created_by prefix "fixture:"), then deletes in dependency
-- order: verification and permalink first, then variant_identifier, variant,
-- catalogue_item, source, category, franchise.
--
-- Safe to run against a database with no fixture rows: every array defaults
-- to empty and every DELETE then matches zero rows.
DO $$
DECLARE
  fixture_franchise_ids int[];
  fixture_category_ids int[];
  fixture_item_ids int[];
  fixture_variant_ids int[];
  fixture_identifier_ids int[];
  fixture_source_ids int[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO fixture_franchise_ids
    FROM franchise WHERE slug LIKE 'fixture-%';

  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO fixture_category_ids
    FROM category WHERE slug LIKE 'fixture-%';

  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO fixture_item_ids
    FROM catalogue_item
    WHERE franchise_id = ANY(fixture_franchise_ids)
       OR category_id = ANY(fixture_category_ids)
       OR created_by LIKE 'fixture:%';

  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO fixture_variant_ids
    FROM variant
    WHERE catalogue_item_id = ANY(fixture_item_ids)
       OR created_by LIKE 'fixture:%';

  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO fixture_identifier_ids
    FROM variant_identifier WHERE variant_id = ANY(fixture_variant_ids);

  SELECT COALESCE(array_agg(DISTINCT s.source_id), ARRAY[]::int[]) INTO fixture_source_ids
  FROM (
    SELECT source_id FROM variant_identifier
      WHERE id = ANY(fixture_identifier_ids) AND source_id IS NOT NULL
    UNION
    SELECT source_id FROM verification
      WHERE (target_table = 'catalogue_item' AND target_id = ANY(fixture_item_ids))
         OR (target_table = 'variant' AND target_id = ANY(fixture_variant_ids))
         OR (target_table = 'variant_identifier' AND target_id = ANY(fixture_identifier_ids))
  ) s;

  DELETE FROM verification
    WHERE (target_table = 'catalogue_item' AND target_id = ANY(fixture_item_ids))
       OR (target_table = 'variant' AND target_id = ANY(fixture_variant_ids))
       OR (target_table = 'variant_identifier' AND target_id = ANY(fixture_identifier_ids));

  DELETE FROM permalink
    WHERE (target_table = 'catalogue_item' AND target_id = ANY(fixture_item_ids))
       OR (target_table = 'variant' AND target_id = ANY(fixture_variant_ids));

  DELETE FROM variant_identifier WHERE id = ANY(fixture_identifier_ids);
  DELETE FROM variant WHERE id = ANY(fixture_variant_ids);
  DELETE FROM catalogue_item WHERE id = ANY(fixture_item_ids);
  DELETE FROM source WHERE id = ANY(fixture_source_ids);
  DELETE FROM category WHERE id = ANY(fixture_category_ids);
  DELETE FROM franchise WHERE id = ANY(fixture_franchise_ids);

  RAISE NOTICE 'Fixture rows removed: % franchise(s), % category(ies), % item(s), % variant(s), % identifier(s), % source(s)',
    array_length(fixture_franchise_ids, 1),
    array_length(fixture_category_ids, 1),
    array_length(fixture_item_ids, 1),
    array_length(fixture_variant_ids, 1),
    array_length(fixture_identifier_ids, 1),
    array_length(fixture_source_ids, 1);
END $$;
