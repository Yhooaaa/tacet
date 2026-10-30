"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from "motion/react";
import { BROKERS, RELIST_DAYS, type Broker, type BrokerStatus } from "@/lib/brokers";
import { KIND_LABEL, maskIdentifier, type Identifier } from "@/lib/identifiers";
import { api, RequestError } from "@/lib/api";
import { Check, External, Spinner } from "@/components/scan/icons";
import EarlyAccess from "@/components/landing/early-access";

type Account = {
  user: { email: string; plan: "free" | "pro"; monitoring: boolean; lastCheckedAt: number | null; intervalDays: number };
  identifiers: (Identifier & { verified_at: number })[];
  alerts: { id: string; created_at: number; title: string; detail: string; read: number }[];
  brokers: { broker_id: string; status: BrokerStatus; updated_at: number }[];
};

const ease = [0.22, 1, 0.36, 1] as const;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(ts: number) {
  const diff = (ts - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(diff) >= size) return rtf.format(Math.round(diff / size), unit);
  return "just now";
}

function upcoming(ts: number) {
  return ago(Math.max(ts, Date.now() + 60_000));
}

const timestamp = () => Date.now();

const STATUS_LABEL: Record<BrokerStatus, string> = { todo: "To do", submitted: "Submitted", removed: "Removed", recheck: "Check again" };

function StatusMark({ status }: { status: BrokerStatus }) {
  if (status === "removed")
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black" aria-hidden="true">
        <Check width={11} height={11} strokeWidth={2} />
      </span>
    );
  if (status === "submitted") return <span className="h-5 w-5 rounded-full border-[5px] border-white/80" aria-hidden="true" />;
  if (status === "recheck") return <span className="h-5 w-5 rounded-full border border-dashed border-white" aria-hidden="true" />;
  return <span className="h-5 w-5 rounded-full border border-white/25" aria-hidden="true" />;
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-white" : "bg-white/15"}`}
    >
      <m.span
        className={`absolute top-1 h-4 w-4 rounded-full ${on ? "bg-black" : "bg-white/70"}`}
        animate={{ left: on ? 24 : 4 }}
        transition={{ duration: 0.3, ease }}
      />
    </button>
  );
}

function BrokerRow({
  broker,
  status,
  updatedAt,
  open,
  onToggle,
  onStatus,
}: {
  broker: Broker;
  status: BrokerStatus;
  updatedAt?: number;
  open: boolean;
  onToggle: () => void;
  onStatus: (s: BrokerStatus) => void;
}) {
  const done = status === "removed";
  return (
    <li className="border-b border-white/[0.07] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] sm:px-6"
      >
        <StatusMark status={status} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] ${done ? "text-white/55" : "text-white"}`}>{broker.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/40">{broker.shows.slice(0, 4).join(", ")}</span>
        </span>
        <span className="hidden shrink-0 text-[12px] text-white/40 sm:block">{broker.region}</span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] ${
            status === "recheck" ? "bg-white text-black" : status === "todo" ? "text-white/45" : "border border-white/20 text-white/75"
          }`}
        >
          {status === "todo" ? `${broker.minutes} min` : STATUS_LABEL[status]}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 pl-[60px] sm:px-6 sm:pl-[60px]">
              <ol className="space-y-2.5">
                {broker.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-[1.55] text-white/75">
                    <span className="w-4 shrink-0 text-right tabular-nums text-white/35">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[13px] text-white/45">
                Takes about {broker.minutes} minutes. {broker.takes} to disappear.
                {broker.note ? ` ${broker.note}` : ""}
              </p>
              {updatedAt && status !== "todo" && <p className="mt-1 text-[12px] text-white/35">Marked {STATUS_LABEL[status].toLowerCase()} {ago(updatedAt)}.</p>}

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <a
                  href={broker.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
                >
                  Open opt-out page
                  <External width={13} height={13} />
                </a>
                {(status === "todo" || status === "recheck") && (
                  <button type="button" onClick={() => onStatus("submitted")} className="h-10 rounded-full border border-white/20 px-4 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white">
                    I&rsquo;ve submitted it
                  </button>
                )}
                {status !== "removed" && (
                  <button type="button" onClick={() => onStatus("removed")} className="h-10 rounded-full border border-white/20 px-4 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white">
                    My listing is gone
                  </button>
                )}
                {status !== "todo" && (
                  <button type="button" onClick={() => onStatus("todo")} className="h-10 px-3 text-[13px] text-white/45 underline-offset-4 hover:text-white hover:underline">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<"all" | "US" | "UK">("all");
  const [openBroker, setOpenBroker] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccount(await api<Account>("/api/account"));
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) router.replace("/signin?next=/dashboard");
      else setError((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    api<Account>("/api/account")
      .then((a) => active && setAccount(a))
      .catch((e) => {
        if (!active) return;
        if (e instanceof RequestError && e.status === 401) router.replace("/signin?next=/dashboard");
        else setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const statusOf = useMemo(() => {
    const map = new Map(account?.brokers.map((t) => [t.broker_id, t]) ?? []);
    return (id: string) => map.get(id);
  }, [account]);

  if (!account) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/55">
        {error ? <p role="alert">{error}</p> : <Spinner />}
      </div>
    );
  }

  const removed = BROKERS.filter((b) => statusOf(b.id)?.status === "removed").length;
  const inProgress = BROKERS.filter((b) => statusOf(b.id)?.status === "submitted").length;
  const unread = account.alerts.filter((a) => !a.read);
  const brokers = BROKERS.filter((b) => region === "all" || b.region === region);

  async function setStatus(brokerId: string, status: BrokerStatus) {
    const previous = account!.brokers;
    const next = previous.filter((t) => t.broker_id !== brokerId);
    if (status !== "todo") next.push({ broker_id: brokerId, status, updated_at: timestamp() });
    setAccount({ ...account!, brokers: next });
    try {
      await api("/api/account/brokers", { method: "PATCH", body: { brokerId, status } });
    } catch (e) {
      setAccount((a) => (a ? { ...a, brokers: previous } : a));
      setError((e as Error).message);
    }
  }

  async function setMonitoring(on: boolean) {
    setAccount({ ...account!, user: { ...account!.user, monitoring: on } });
    await api("/api/account", { method: "PATCH", body: { monitoring: on } }).catch(load);
  }

  async function checkNow() {
    setChecking(true);
    setCheckNote(null);
    try {
      const r = await api<{ newBreaches: string[]; rechecks: string[] }>("/api/account/check", { method: "POST" });
      setCheckNote(r.newBreaches.length ? `${r.newBreaches.length} new breach${r.newBreaches.length > 1 ? "es" : ""} found.` : "Nothing new since the last check.");
      await load();
    } catch (e) {
      setCheckNote((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function removeDetail(value: string) {
    try {
      await api("/api/account/identifiers", { method: "DELETE", body: { value } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function signOut() {
    await api("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  async function deleteAccount() {
    await api("/api/account", { method: "DELETE" });
    router.replace("/");
  }

  const { user } = account;
  const nextCheck = user.lastCheckedAt ? user.lastCheckedAt + user.intervalDays * 86400_000 : null;

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto w-full max-w-[880px] px-5 pb-24 pt-10 md:pt-14">
          <div className="rise flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[34px] font-medium leading-[1.05] sm:text-[44px]">Your privacy</h1>
              <p className="mt-2 text-[14px] text-white/45">Signed in as {user.email}</p>
            </div>
            <Link href="/scan" className="inline-flex h-10 items-center rounded-full border border-white/20 px-4 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white">
              Run a new scan
            </Link>
          </div>

          {error && (
            <p role="alert" className="mt-6 rounded-xl border border-white/20 px-4 py-3 text-[14px] text-white">
              {error}
            </p>
          )}

          {user.plan !== "pro" && (
            <div className="mt-10">
              <EarlyAccess via="dashboard" signedIn lead="Monitoring, the deep scan and data removal are part of Tacet Pro, which opens soon." />
            </div>
          )}

          <section aria-label="Overview" className="mt-10 grid overflow-hidden rounded-2xl border border-white/12 sm:grid-cols-3">
            {user.plan === "pro" ? (
            <div className="border-b border-white/10 p-6 sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[14px] text-white/55">Breach monitoring</h2>
                <Switch on={user.monitoring} onChange={setMonitoring} label="Breach monitoring" />
              </div>
              <p className="font-display mt-5 text-[28px] font-medium leading-none">{user.monitoring ? "On" : "Off"}</p>
              <p className="mt-3 text-[13px] leading-[1.5] text-white/45">
                {user.lastCheckedAt ? `Last checked ${ago(user.lastCheckedAt)}.` : "Not checked yet."}
                {user.monitoring && nextCheck ? ` Next check ${upcoming(nextCheck)}.` : ""}
              </p>
              <button
                type="button"
                onClick={checkNow}
                disabled={checking}
                className="mt-4 inline-flex items-center gap-2 text-[13px] text-white/75 underline-offset-4 hover:text-white hover:underline disabled:no-underline disabled:opacity-60"
              >
                {checking && <Spinner />}
                {checking ? "Checking" : "Check now"}
              </button>
              {checkNote && <p className="mt-2 text-[13px] text-white/60">{checkNote}</p>}
            </div>
            ) : (
              <div className="border-b border-white/10 p-6 sm:border-b-0 sm:border-r">
                <h2 className="text-[14px] text-white/55">Breach monitoring</h2>
                <p className="font-display mt-5 text-[28px] font-medium leading-none">Pro</p>
                <p className="mt-3 text-[13px] leading-[1.5] text-white/45">Part of Tacet Pro, opening soon. Reserve it above for 50% off.</p>
              </div>
            )}

            <div className="border-b border-white/10 p-6 sm:border-b-0 sm:border-r">
              <h2 className="text-[14px] text-white/55">Broker removals</h2>
              <p className="font-display mt-5 text-[28px] font-medium leading-none tabular-nums">
                {removed}
                <span className="text-white/35"> / {BROKERS.length}</span>
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={BROKERS.length} aria-valuenow={removed} aria-label="Brokers removed">
                <m.div className="h-full rounded-full bg-white" initial={false} animate={{ width: `${(removed / BROKERS.length) * 100}%` }} transition={{ duration: 0.6, ease }} />
              </div>
              <p className="mt-3 text-[13px] text-white/45">{inProgress ? `${inProgress} waiting on the broker.` : "Start with any broker below."}</p>
            </div>

            <div className="p-6">
              <h2 className="text-[14px] text-white/55">Alerts</h2>
              <p className="font-display mt-5 text-[28px] font-medium leading-none tabular-nums">{unread.length}</p>
              <p className="mt-3 text-[13px] text-white/45">{unread.length ? "New since you last looked." : "Nothing new. We'll email you if that changes."}</p>
            </div>
          </section>

          {account.alerts.length > 0 && (
            <section aria-labelledby="alerts-title" className="mt-12">
              <div className="flex items-center justify-between">
                <h2 id="alerts-title" className="text-[17px] font-medium">
                  Alerts
                </h2>
                {unread.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api("/api/account/alerts", { method: "POST" }).catch(() => {});
                      load();
                    }}
                    className="text-[13px] text-white/55 underline-offset-4 hover:text-white hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <ul className="mt-4 overflow-hidden rounded-2xl border border-white/12">
                {account.alerts.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-4 border-b border-white/[0.07] px-5 py-4 last:border-0 sm:px-6">
                    <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${a.read ? "bg-white/20" : "bg-white"}`} aria-label={a.read ? undefined : "Unread"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-white">{a.title}</p>
                      <p className="mt-1 text-[13px] leading-[1.55] text-white/50">{a.detail}</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-white/35">{ago(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="brokers-title" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[56ch]">
                <h2 id="brokers-title" className="text-[17px] font-medium">
                  Remove yourself from data brokers
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-white/50">
                  These sites sell profiles with people&rsquo;s addresses, phone numbers and relatives. Removal is free and takes a few minutes each. We&rsquo;ll remind you to
                  check again after {RELIST_DAYS} days, because brokers often add people back.
                </p>
              </div>
              <div role="tablist" aria-label="Region" className="flex gap-1 rounded-full border border-white/12 p-1">
                {(["all", "US", "UK"] as const).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={region === key}
                    onClick={() => setRegion(key)}
                    className={`relative rounded-full px-3 py-1 text-[12px] transition-colors ${region === key ? "text-black" : "text-white/55 hover:text-white"}`}
                  >
                    {region === key && <m.span layoutId="region-filter" className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.3, ease }} />}
                    <span className="relative">{key === "all" ? "All" : key}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-5 overflow-hidden rounded-2xl border border-white/12">
              {brokers.map((b) => {
                const task = statusOf(b.id);
                return (
                  <BrokerRow
                    key={b.id}
                    broker={b}
                    status={task?.status ?? "todo"}
                    updatedAt={task?.updated_at}
                    open={openBroker === b.id}
                    onToggle={() => setOpenBroker((id) => (id === b.id ? null : b.id))}
                    onStatus={(s) => setStatus(b.id, s)}
                  />
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="details-title" className="mt-14">
            <div className="flex items-center justify-between">
              <h2 id="details-title" className="text-[17px] font-medium">
                Monitored details
              </h2>
              <Link href="/scan" className="text-[13px] text-white/55 underline-offset-4 hover:text-white hover:underline">
                Add more
              </Link>
            </div>
            <p className="mt-2 text-[14px] text-white/50">
              {user.plan === "pro"
                ? `Emails are re-checked against known breaches every ${user.intervalDays} days.`
                : "With Tacet Pro, these emails are re-checked against known breaches every week."}
            </p>
            <ul className="mt-4 overflow-hidden rounded-2xl border border-white/12">
              {account.identifiers.map((i) => (
                <li key={`${i.kind}:${i.value}`} className="flex items-center gap-4 border-b border-white/[0.07] px-5 py-4 last:border-0 sm:px-6">
                  <span className="w-24 shrink-0 text-[12px] text-white/40">{KIND_LABEL[i.kind]}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-white">{i.kind === "username" ? i.value : maskIdentifier(i)}</span>
                  {i.kind === "email" && i.value === user.email ? (
                    <span className="text-[12px] text-white/35">Sign-in email</span>
                  ) : (
                    <button type="button" onClick={() => removeDetail(i.value)} className="text-[13px] text-white/45 underline-offset-4 hover:text-white hover:underline">
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="account-title" className="mt-14 border-t border-white/10 pt-8">
            <h2 id="account-title" className="sr-only">
              Account
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-[52ch] text-[13px] leading-[1.6] text-white/40">
                We store your verified details, the names of breaches they appeared in, your removal progress and alerts. Nothing else, and never the leaked records.
              </p>
              <div className="flex items-center gap-5">
                <button type="button" onClick={signOut} className="text-[13px] text-white/60 underline-offset-4 hover:text-white hover:underline">
                  Sign out
                </button>
                {confirmDelete ? (
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={deleteAccount} className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black">
                      Delete everything
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-[13px] text-white/50 hover:text-white">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="text-[13px] text-white/60 underline-offset-4 hover:text-white hover:underline">
                    Delete account
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
