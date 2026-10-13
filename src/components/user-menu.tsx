import Link from "next/link";
import { UserMenuDropdown } from "@/components/user-menu-dropdown";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

// Reads the session, so it must render inside <Suspense> (see SiteHeader).
export async function UserMenu() {
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
        登录
      </Link>
    );
  }

  const { name, email, image } = session.user;
  return <UserMenuDropdown name={name} email={email} image={image ?? null} />;
}
