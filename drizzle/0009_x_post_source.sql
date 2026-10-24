CREATE TABLE "x_post_source" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"repo" text NOT NULL,
	"installation_id" text,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"last_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "x_post_source" ADD CONSTRAINT "x_post_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "x_post_source_user_repo_idx" ON "x_post_source" USING btree ("user_id","repo");