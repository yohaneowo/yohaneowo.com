import Image from "next/image";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { getPlayer } from "@/lib/dota/data";

// Whose heat map this is: the player's Steam avatar and name, linking to their overview.
export async function PlayerChip({
  accountId,
  lang,
  own,
}: {
  accountId: number;
  lang: Locale;
  own: boolean;
}) {
  const player = await getPlayer(accountId).catch(() => null);
  const profile = player?.data.profile;
  if (!profile) return null;
  return (
    <Link
      href={localePath(lang, own ? "/dotahub" : `/dotahub/players/${accountId}`)}
      className="inline-flex items-center gap-2 self-start rounded-full py-0.5 pr-3 text-sm hover:bg-muted"
    >
      {profile.avatarfull ? (
        <Image
          src={profile.avatarfull}
          alt=""
          width={28}
          height={28}
          unoptimized
          className="size-7 rounded-full"
        />
      ) : (
        <span className="size-7 rounded-full bg-muted" />
      )}
      <span className="font-medium">{profile.personaname}</span>
    </Link>
  );
}
