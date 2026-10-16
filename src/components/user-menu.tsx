import Link from "next/link";
import { UserMenuDropdown } from "@/components/user-menu-dropdown";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";

// Reads the session, so it must render inside <Suspense> (see SiteHeader).
export async function UserMenu() {
  const session = await getSession();

  if (!session) {
    const t = await getDictionary();
    return (
      <Link
        href={localePath(await getLocale(), "/login")}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t.header.login}
      </Link>
    );
  }

  const { name, email, image } = session.user;
  return <UserMenuDropdown name={name} email={email} image={image ?? null} />;
}
