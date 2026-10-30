"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from "motion/react";
import { detectIdentifier, identifierKey, KIND_LABEL, maskIdentifier, type Identifier } from "@/lib/identifiers";
import { phoneInfo } from "@/lib/phone";
import { startVerification, streamScan, type StartResponse } from "@/lib/api";
import type { Finding, Report, ScanEvent, StepId } from "@/types/scan";
import Composer from "./composer";
import { TacetMark } from "./icons";
import type { QueueState, StepState } from "./scan-progress";
import ScanWorkspace from "./scan-workspace";
import VerifyCard, { type Challenge } from "./verify-card";

type Item =
  | { id: string; type: "user"; identifier: Identifier }
  | { id: string; type: "verify"; challenge: Challenge; verified: boolean }
  | { id: string; type: "ready" }
  | { id: string; type: "scan"; steps: Partial<Record<StepId, StepState>>; findings: Finding[]; report?: Report; finished: boolean; queue?: QueueState }
  | { id: string; type: "notice"; text: string };

type State = { items: Item[]; proofs: { identifier: Identifier; proof: string }[]; scanning: boolean };

type Action =
  | { type: "add"; items: Item[] }
  | { type: "verified"; id: string; identifier: Identifier; proof: string }
  | { type: "replaceChallenge"; id: string; challenge: Challenge }
  | { type: "scanStart"; id: string }
  | { type: "scanEvent"; id: string; event: ScanEvent }
  | { type: "scanEnd"; id: string }
  | { type: "reset" };

const initial: State = { items: [], proofs: [], scanning: false };

let seq = 0;
const uid = () => `i${++seq}`;

function updateScan(items: Item[], id: string, fn: (item: Extract<Item, { type: "scan" }>) => Item): Item[] {
  return items.map((it) => (it.id === id && it.type === "scan" ? fn(it) : it));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const keep = action.items.some((it) => it.type === "verify" || it.type === "ready") ? state.items.filter((it) => it.type !== "ready") : state.items;
      return { ...state, items: [...keep, ...action.items] };
    }
    case "verified": {
      const items = state.items
        .filter((it) => it.type !== "ready")
        .map((it) => (it.id === action.id && it.type === "verify" ? { ...it, verified: true } : it));
      return {
        ...state,
        items: [...items, { id: uid(), type: "ready" }],
        proofs: [...state.proofs.filter((p) => identifierKey(p.identifier) !== identifierKey(action.identifier)), { identifier: action.identifier, proof: action.proof }],
      };
    }
    case "replaceChallenge":
      return { ...state, items: state.items.map((it) => (it.id === action.id && it.type === "verify" ? { ...it, challenge: action.challenge } : it)) };
    case "scanStart":
      return {
        ...state,
        scanning: true,
        items: [...state.items.filter((it) => it.type !== "ready"), { id: action.id, type: "scan", steps: {}, findings: [], finished: false }],
      };
    case "scanEvent": {
      const e = action.event;
      if (e.type === "queue") return { ...state, items: updateScan(state.items, action.id, (it) => ({ ...it, queue: { position: e.position, etaSeconds: e.etaSeconds } })) };
      if (e.type === "step") {
        return {
          ...state,
          items: updateScan(state.items, action.id, (it) => ({ ...it, queue: undefined, steps: { ...it.steps, [e.id]: { label: e.label, status: e.status, note: e.note, count: e.count } } })),
        };
      }
      if (e.type === "finding") return { ...state, items: updateScan(state.items, action.id, (it) => ({ ...it, findings: [...it.findings, e.finding] })) };
      if (e.type === "report") return { ...state, items: updateScan(state.items, action.id, (it) => ({ ...it, report: e.report })) };
      if (e.type === "error") return { ...state, items: [...state.items, { id: uid(), type: "notice", text: e.message }] };
      return state;
    }
    case "scanEnd":
      return { ...state, scanning: false, items: updateScan(state.items, action.id, (it) => ({ ...it, finished: true, queue: undefined })) };
    case "reset":
      return initial;
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

function TacetTurn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white">
        <TacetMark />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

export default function ScanApp() {
  const [state, dispatch] = useReducer(reducer, initial);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const started = state.items.length > 0;
  const pending = state.items.some((it) => it.type === "verify" && !it.verified);
  const runIndex = state.items.findLastIndex((it) => it.type === "scan");
  const run = runIndex >= 0 ? (state.items[runIndex] as Extract<Item, { type: "scan" }>) : null;
  const usernames = useMemo(
    () =>
      state.items.flatMap((it) =>
        it.type === "user" && it.identifier.kind === "username" && !state.proofs.some((p) => identifierKey(p.identifier) === identifierKey(it.identifier))
          ? [it.identifier]
          : [],
      ),
    [state.items, state.proofs],
  );
  const details = [...state.proofs.map((p) => p.identifier), ...usernames];
  const inWorkspace = Boolean(run);

  useEffect(() => {
    if (started && !inWorkspace) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.items.length, started, inWorkspace]);

  useEffect(() => {
    if (inWorkspace) window.scrollTo({ top: 0 });
  }, [inWorkspace]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = useCallback(
    async (value: string) => {
      const detection = detectIdentifier(value);
      if (detection.ok && detection.identifier.kind === "username") {
        const already = state.items.some(
          (it) => it.type === "user" && identifierKey(it.identifier) === identifierKey(detection.identifier),
        );
        if (already) {
          dispatch({
            type: "add",
            items: [{ id: uid(), type: "notice", text: "You've already added that username. Add something else or start the scan." }],
          });
          return true;
        }
        dispatch({ type: "add", items: [{ id: uid(), type: "user", identifier: detection.identifier }, { id: uid(), type: "ready" }] });
        return true;
      }

      let res: StartResponse;
      try {
        res = await startVerification(value);
      } catch (e) {
        dispatch({ type: "add", items: [{ id: uid(), type: "notice", text: (e as Error).message }] });
        return false;
      }
      if (state.proofs.some((p) => identifierKey(p.identifier) === identifierKey(res.identifier))) {
        dispatch({
          type: "add",
          items: [
            { id: uid(), type: "user", identifier: res.identifier },
            { id: uid(), type: "notice", text: "You've already verified that one. Add something else or start the scan." },
          ],
        });
        return true;
      }
      dispatch({
        type: "add",
        items: [
          { id: uid(), type: "user", identifier: res.identifier },
          { id: uid(), type: "verify", verified: false, challenge: res },
        ],
      });
      return true;
    },
    [state.proofs, state.items],
  );

  const resend = useCallback(async (id: string, identifier: Identifier) => {
    try {
      const res = await startVerification(identifier.value);
      dispatch({ type: "replaceChallenge", id, challenge: res });
    } catch (e) {
      dispatch({ type: "add", items: [{ id: uid(), type: "notice", text: (e as Error).message }] });
    }
  }, []);

  const scan = useCallback(async () => {
    const id = uid();
    dispatch({ type: "scanStart", id });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamScan(
        state.proofs.map((p) => p.proof),
        (event) => dispatch({ type: "scanEvent", id, event }),
        controller.signal,
        usernames.map((u) => u.value),
      );
    } catch (e) {
      if (!controller.signal.aborted) dispatch({ type: "add", items: [{ id: uid(), type: "notice", text: (e as Error).message }] });
    } finally {
      dispatch({ type: "scanEnd", id });
    }
  }, [state.proofs, usernames]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
    window.scrollTo({ top: 0 });
  }, []);

  const composerDisabled = pending || state.scanning;
  const disabledHint = state.scanning ? "Scanning. This usually takes a minute or two." : "Confirm the detail above first";

  if (run) {
    return (
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">
          <ScanWorkspace
            run={run}
            proofs={state.proofs}
            details={details}
            notices={state.items.slice(runIndex + 1).flatMap((it) => (it.type === "notice" ? [{ id: it.id, text: it.text }] : []))}
            onRetry={scan}
            onClear={reset}
          />
        </MotionConfig>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <div className={`mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 ${started ? "pb-44 pt-8" : "justify-center pb-[12vh]"}`}>
          <AnimatePresence initial={false}>
            {!started && (
              <m.div key="intro" exit={{ opacity: 0, y: -12, filter: "blur(4px)" }} transition={{ duration: 0.35, ease }} className="mb-10 text-center">
                <h1 className="font-display rise text-[34px] font-medium leading-[1.05] sm:text-[46px]">What should Tacet look for?</h1>
                <p className="rise mx-auto mt-4 max-w-[30rem] text-[16px] leading-[1.6] text-white/55" style={{ "--d": "120ms" } as CSSProperties}>
                  Start with one detail, then add more and run one scan across all of them.
                </p>
              </m.div>
            )}
          </AnimatePresence>

          {started && (
            <ol className="space-y-7" aria-label="Scan conversation">
              <AnimatePresence initial={false}>
                {state.items.map((item) => (
                  <m.li
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.45, ease }}
                  >
                    {item.type === "user" && (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5">
                          <p className="text-[11px] text-white/45">
                            {KIND_LABEL[item.identifier.kind]}
                            {item.identifier.kind === "phone" && phoneInfo(item.identifier.value) && ` · ${phoneInfo(item.identifier.value)}`}
                          </p>
                          <p className="break-all font-mono text-[14px] text-white">{item.identifier.value}</p>
                        </div>
                      </div>
                    )}

                    {item.type === "verify" && (
                      <TacetTurn>
                        <VerifyCard
                          challenge={item.challenge}
                          verified={item.verified}
                          onVerified={(proof) => dispatch({ type: "verified", id: item.id, identifier: item.challenge.identifier, proof })}
                          onResend={() => resend(item.id, item.challenge.identifier)}
                        />
                      </TacetTurn>
                    )}

                    {item.type === "ready" && (
                      <TacetTurn>
                        <p className="text-[15px] leading-[1.6] text-white/80">
                          {details.length === 1
                            ? "Add another email, phone number or username to get a fuller picture, or scan now."
                            : `${details.length} details ready. Add more, or scan them together.`}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {details.map((id) => (
                            <span key={identifierKey(id)} className="rounded-full border border-white/15 px-3 py-1 font-mono text-[12px] text-white/70">
                              {id.kind === "username" ? id.value : maskIdentifier(id)}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={scan}
                          className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 text-[15px] font-medium text-black transition-[background-color,transform] duration-200 hover:bg-white/85 active:scale-[0.98]"
                        >
                          Start scan
                        </button>
                      </TacetTurn>
                    )}

                    {item.type === "notice" && (
                      <TacetTurn>
                        <p role="alert" className="text-[15px] leading-[1.6] text-white/80">
                          {item.text}
                        </p>
                      </TacetTurn>
                    )}
                  </m.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
          <div ref={bottomRef} />

          <m.div
            layout
            transition={{ duration: 0.55, ease }}
            className={
              started
                ? "fixed inset-x-0 bottom-0 z-40 bg-linear-to-t from-black from-60% to-transparent px-5 pb-4 pt-10"
                : "relative"
            }
          >
            <div className="mx-auto w-full max-w-[720px]">
              <Composer onSubmit={submit} disabled={composerDisabled} disabledHint={disabledHint} invite={!started} autoFocus />
            </div>
          </m.div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
