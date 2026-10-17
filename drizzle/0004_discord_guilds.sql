CREATE TABLE "discord_guild" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_guild_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
ALTER TABLE "discord_guild" ADD CONSTRAINT "discord_guild_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discord_guild_guild_idx" ON "discord_guild" USING btree ("guild_id");