CREATE TABLE "roadmap_suggestion_like" (
	"user_id" text NOT NULL,
	"suggestion_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_suggestion_like_user_id_suggestion_id_pk" PRIMARY KEY("user_id","suggestion_id")
);
--> statement-breakpoint
ALTER TABLE "roadmap_suggestion_like" ADD CONSTRAINT "roadmap_suggestion_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_suggestion_like" ADD CONSTRAINT "roadmap_suggestion_like_suggestion_id_roadmap_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."roadmap_suggestion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roadmap_suggestion_like_suggestion_idx" ON "roadmap_suggestion_like" USING btree ("suggestion_id");