"use client";

import { LogOutIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";

type UserMenuDropdownProps = {
  name: string;
  email: string;
  image: string | null;
};

export function UserMenuDropdown({ name, email, image }: UserMenuDropdownProps) {
  const router = useRouter();
  const { t, href } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setError(t.header.signOutFailed);
        return;
      }
      router.replace(href("/"));
      router.refresh();
    } catch {
      setError(t.header.authUnreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full" aria-label={t.header.accountMenu}>
          <Avatar>
            {image && <AvatarImage src={image} alt={name} />}
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="font-medium text-foreground">{name}</div>
              <div className="truncate text-xs">{email}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(href("/settings"))}>
            <SettingsIcon />
            {t.header.settings}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} disabled={pending}>
            <LogOutIcon />
            {pending ? t.header.signingOut : t.header.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p
          role="alert"
          className="absolute top-full right-0 mt-2 w-64 rounded-md border bg-background p-3 text-sm text-destructive shadow-md"
        >
          {error}
        </p>
      )}
    </div>
  );
}
