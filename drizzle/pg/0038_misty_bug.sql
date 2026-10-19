CREATE TABLE "wandofi_dataforseo_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"path" text NOT NULL,
	"cost_usd" real NOT NULL,
	"project_id" text,
	"organization_id" text
);
--> statement-breakpoint
CREATE TABLE "wandofi_project_spend_caps" (
	"project_id" text PRIMARY KEY NOT NULL,
	"monthly_cap_usd" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wandofi_dataforseo_calls" ADD CONSTRAINT "wandofi_dataforseo_calls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wandofi_project_spend_caps" ADD CONSTRAINT "wandofi_project_spend_caps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wandofi_dataforseo_calls_created_at_idx" ON "wandofi_dataforseo_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wandofi_dataforseo_calls_project_created_idx" ON "wandofi_dataforseo_calls" USING btree ("project_id","created_at");