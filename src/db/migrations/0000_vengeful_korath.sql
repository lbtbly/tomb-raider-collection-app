CREATE TABLE "catalogue_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" char(10) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"franchise_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"release_year" integer,
	"copyright_year" integer,
	"publisher" text,
	"developer" text,
	"description_md" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"merged_into_id" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_item_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_op" (
	"id" char(36) PRIMARY KEY NOT NULL,
	"device_id" varchar(80) NOT NULL,
	"kind" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "franchise" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" char(10) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "franchise_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "franchise_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "identifier_kind" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(40) NOT NULL,
	"label_key" varchar(80) NOT NULL,
	"validator" varchar(40),
	CONSTRAINT "identifier_kind_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "permalink" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" char(10) NOT NULL,
	"target_table" varchar(40) NOT NULL,
	"target_id" integer NOT NULL,
	"is_canonical" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permalink_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "provenance_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(40) NOT NULL,
	"label_key" varchar(80) NOT NULL,
	"is_sold" boolean NOT NULL,
	"mark_style" varchar(40) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "provenance_type_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(40) NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"publisher" text,
	"retrieved_on" date NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" char(10) NOT NULL,
	"catalogue_item_id" integer NOT NULL,
	"name" text NOT NULL,
	"provenance_type_id" integer NOT NULL,
	"region_note" text,
	"release_date" date,
	"print_run" integer,
	"edition_number" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"merged_into_id" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "variant_identifier" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"identifier_kind_id" integer NOT NULL,
	"value" text NOT NULL,
	"normalized" text GENERATED ALWAYS AS (lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g'))) STORED,
	"source_id" integer
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_table" varchar(40) NOT NULL,
	"target_id" integer NOT NULL,
	"method" varchar(40) NOT NULL,
	"source_id" integer NOT NULL,
	"verified_on" date NOT NULL,
	"verified_by" varchar(80),
	"note" text
);
--> statement-breakpoint
ALTER TABLE "catalogue_item" ADD CONSTRAINT "catalogue_item_franchise_id_franchise_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_item" ADD CONSTRAINT "catalogue_item_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_catalogue_item_id_catalogue_item_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_provenance_type_id_provenance_type_id_fk" FOREIGN KEY ("provenance_type_id") REFERENCES "public"."provenance_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_identifier" ADD CONSTRAINT "variant_identifier_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_identifier" ADD CONSTRAINT "variant_identifier_identifier_kind_id_identifier_kind_id_fk" FOREIGN KEY ("identifier_kind_id") REFERENCES "public"."identifier_kind"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_identifier" ADD CONSTRAINT "variant_identifier_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification" ADD CONSTRAINT "verification_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogue_item_franchise_idx" ON "catalogue_item" USING btree ("franchise_id");--> statement-breakpoint
CREATE INDEX "catalogue_item_category_idx" ON "catalogue_item" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "catalogue_item_updated_idx" ON "catalogue_item" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "category_parent_idx" ON "category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "client_op_device_idx" ON "client_op" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "variant_item_idx" ON "variant" USING btree ("catalogue_item_id");--> statement-breakpoint
CREATE INDEX "variant_provenance_idx" ON "variant" USING btree ("provenance_type_id");--> statement-breakpoint
CREATE INDEX "variant_updated_idx" ON "variant" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "variant_identifier_normalized_idx" ON "variant_identifier" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "variant_identifier_variant_idx" ON "variant_identifier" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "verification_target_idx" ON "verification" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_target_unique_idx" ON "verification" USING btree ("target_table","target_id");