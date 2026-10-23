"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  MusicIcon,
  VideoIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { localePath } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";
import type { LinkFormat, LinkItem, LinkParseError, LinkParseResult } from "@/lib/linkhub";
import { cn } from "@/lib/utils";
import { parseLinkAction } from "./actions";

// The parse form and what came back: the post (author, text, stats) and every media item with
// its formats, each with a download button that streams through the site.
export function LinkParser({ signedIn }: { signedIn: boolean }) {
  const { t, lang } = useLocale();
  const l = t.linkhub;
  const [url, setUrl] = useState("");
  const [nocache, setNocache] = useState(false);
  const [result, setResult] = useState<LinkParseResult | LinkParseError | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!url.trim()) return;
    start(async () => {
      setResult(await parseLinkAction({ url, nocache }));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={l.placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={!signedIn}
            className="font-mono text-sm"
          />
          <Button type="submit" disabled={!signedIn || pending || !url.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? l.parsing : l.submit}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {signedIn ? (
            <label className="flex items-center gap-2">
              <Switch checked={nocache} onCheckedChange={setNocache} />
              {l.nocache}
            </label>
          ) : (
            <span>
              {l.signIn}{" "}
              <Link href={localePath(lang, "/login")} className="underline hover:text-foreground">
                {t.header.login}
              </Link>
            </span>
          )}
        </div>
      </form>
      {result && (result.ok ? <ParseResult result={result} /> : <ParseFailure error={result} />)}
    </div>
  );
}

function ParseFailure({ error }: { error: LinkParseError }) {
  const { t } = useLocale();
  const l = t.linkhub;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4 text-sm">
        <p className="text-[#f23645]">
          {l.errors[error.code] ?? l.errors.generic}
          {error.message && !l.errors[error.code] ? ` (${error.message})` : ""}
        </p>
        {error.attempts && error.attempts.length > 0 && <Attempts attempts={error.attempts} />}
      </CardContent>
    </Card>
  );
}

function Attempts({ attempts }: { attempts: LinkParseResult["meta"]["attempts"] }) {
  const { t } = useLocale();
  const l = t.linkhub.result;
  return (
    <div className="text-xs text-muted-foreground">
      <div className="font-medium">{l.attempts}</div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {attempts.map((a, i) => (
          <li key={`${a.adapter}-${i}`} className="flex flex-wrap gap-x-2">
            <span className="font-mono">{a.adapter}</span>
            <span className={a.code === "OK" ? "text-[#089981]" : "text-[#f23645]"}>{a.code}</span>
            <span>{l.took(a.durationMs)}</span>
            {a.message && <span className="truncate">{a.message}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParseResult({ result }: { result: LinkParseResult }) {
  const { t, lang } = useLocale();
  const l = t.linkhub;
  const r = l.result;
  const { post, items, meta } = result;
  const [copied, setCopied] = useState(false);
  const text = post.text?.trim() ?? "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(l.errors.generic);
    }
  };
  const stats = Object.entries(post.stats ?? {}).filter(([, v]) => typeof v === "number") as Array<
    [keyof typeof r.stats, number]
  >;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Badge variant="secondary">{l.platformNames[result.platform] ?? result.platform}</Badge>
        {meta.adapter && <span>{r.via(meta.adapter, meta.engine ?? "")}</span>}
        <span>{r.took(meta.durationMs)}</span>
        {meta.cached && <Badge variant="outline">{r.cached}</Badge>}
      </div>
      {meta.linkValidation === "failed" && <p className="text-xs text-amber-600">{r.linkValidationFailed}</p>}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          {(post.author || post.publishedAt) && (
            <div className="flex items-center gap-2 text-sm">
              {post.author?.avatar && (
                // eslint-disable-next-line @next/next/no-img-element -- a third-party avatar
                <img src={post.author.avatar} alt="" className="size-8 rounded-full" loading="lazy" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">
                  {post.author?.url ? (
                    <a href={post.author.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {post.author.name ?? post.author.handle}
                    </a>
                  ) : (
                    (post.author?.name ?? post.author?.handle)
                  )}
                  {post.author?.name && post.author.handle && (
                    <span className="ml-1 font-normal text-muted-foreground">{post.author.handle}</span>
                  )}
                </span>
                {post.publishedAt && (
                  <span className="text-xs text-muted-foreground">
                    {r.publishedAt} {fmtDate(post.publishedAt, lang)}
                  </span>
                )}
              </div>
            </div>
          )}
          {post.title && <h2 className="text-lg font-semibold">{post.title}</h2>}
          {text ? (
            <p className="text-sm whitespace-pre-wrap">{text}</p>
          ) : (
            !items.length && <p className="text-sm text-muted-foreground">{r.textOnly}</p>
          )}
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {stats.map(([key, value]) => (
                <span key={key}>
                  {value.toLocaleString()} {r.stats[key]}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLinkIcon />
              {r.openOriginal}
            </a>
            {text && (
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? r.copied : r.copyText}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {items.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">{r.items(items.length)}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item, i) => (
              <MediaItem
                key={item.id ?? i}
                item={item}
                index={i + 1}
                title={post.title ?? post.id ?? "media"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TYPE_ICONS = { video: VideoIcon, image: ImageIcon, audio: MusicIcon, article: FileTextIcon };

function MediaItem({ item, index, title }: { item: LinkItem; index: number; title: string }) {
  const { t, lang } = useLocale();
  const r = t.linkhub.result;
  const Icon = TYPE_ICONS[item.type] ?? FileTextIcon;
  const best = item.formats[0];
  const preview = item.type === "image" ? (best?.download ?? best?.url) : item.cover;
  return (
    <Card className="overflow-hidden">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- media from the parsed post
        <img src={preview} alt="" className="max-h-72 w-full bg-muted object-contain" loading="lazy" />
      )}
      <CardContent className="flex flex-col gap-2 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          <span>
            {r.types[item.type] ?? item.type} #{index}
          </span>
          {item.durationSec !== undefined && <span>· {r.duration(item.durationSec)}</span>}
          {item.width && item.height && (
            <span>
              · {item.width}×{item.height}
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-1">
          {item.formats.map((f, i) => (
            <FormatRow key={f.id ?? i} format={f} name={fileName(title, index, f)} lang={lang} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FormatRow({ format: f, name, lang }: { format: LinkFormat; name: string; lang: string }) {
  const { t } = useLocale();
  const r = t.linkhub.result;
  const flags = [
    f.hasAudio === false && f.hasVideo !== false ? r.noAudio : null,
    f.hasVideo === false ? r.noVideo : null,
  ].filter(Boolean);
  const codec = [f.videoCodec, f.audioCodec].filter(Boolean).join("+");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
        {f.quality && <span className="font-medium text-foreground">{f.quality}</span>}
        {f.ext && <span className="uppercase">{f.ext}</span>}
        {f.sizeBytes !== undefined && <span>{fmtBytes(f.sizeBytes)}</span>}
        {codec && <span className="font-mono">{codec}</span>}
        {flags.map((flag) => (
          <span key={flag}>{flag}</span>
        ))}
        {f.expiresAt && <span>{r.expires(fmtDate(f.expiresAt, lang))}</span>}
      </span>
      <span className="flex gap-1">
        {f.download ? (
          <a
            href={`${f.download}&name=${encodeURIComponent(name)}`}
            download={name}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
          >
            <DownloadIcon />
            {r.download}
          </a>
        ) : (
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
          >
            <ExternalLinkIcon />
            {r.open}
          </a>
        )}
      </span>
    </li>
  );
}

function fileName(title: string, index: number, f: LinkFormat) {
  const stem =
    title
      .replace(/[\\/:*?"<>|\s]+/g, " ")
      .trim()
      .slice(0, 60) || "media";
  const ext = /^[a-z0-9]{2,5}$/i.test(f.ext ?? "") ? f.ext!.toLowerCase() : "bin";
  return `${stem}-${index}${f.quality ? `-${f.quality}` : ""}.${ext}`;
}

function fmtBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}

function fmtDate(iso: string, lang: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
