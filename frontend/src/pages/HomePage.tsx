import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { TermCard } from "../components/TermCard";
import termsData from "../data/terms.json";
import { EngagementBar } from "../components/EngagementBar";
import { SKIP_HOME_VIEW_KEY } from "../constants/storageKeys";
import { fetchHomeStats, postStatsEvent } from "../services/api";
import {
  addUsedHotTerm,
  clearUsedHotTerms,
  readUsedHotTerms,
} from "../utils/homeUsedHotTerms";
import { normalizeTermPool, pickThreeTermsWithOneLatest } from "../utils/termPool";
import { stripTrailingTermPunctuation } from "../utils/termText";

const TERM_ENTRIES = normalizeTermPool(termsData);

import type {
  SpeechRecognitionConstructorLike,
  SpeechRecognitionLike,
} from "../types/speech";

function getSpeechRecognition(): SpeechRecognitionConstructorLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [homePick] = useState(() =>
    pickThreeTermsWithOneLatest(TERM_ENTRIES, readUsedHotTerms())
  );
  const { cards, hotLabel, hotExclusionsExhausted } = homePick;
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [homeStats, setHomeStats] = useState({ views: 0, likes: 0, shares: 0 });

  const refreshHomeStats = useCallback(async () => {
    const r = await fetchHomeStats();
    if (r.ok) {
      setHomeStats({ views: r.homeViews, likes: r.likes, shares: r.shares });
    }
  }, []);

  const speechSupported = useMemo(() => {
    const Ctor = getSpeechRecognition();
    return typeof Ctor === "function";
  }, []);

  const submit = useCallback(() => {
    const t = query.trim();
    if (!t) return;
    navigate(`/explain?term=${encodeURIComponent(t)}`);
  }, [query, navigate]);

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    setMicHint(null);
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setMicHint("当前浏览器不支持语音输入。");
      return;
    }
    if (listening) {
      stopRecognition();
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = "zh-CN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const raw = ev.results[0]?.[0]?.transcript?.trim() ?? "";
        const text = stripTrailingTermPunctuation(raw);
        if (text) setQuery(text.slice(0, 64));
        stopRecognition();
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed") {
          setMicHint("请在浏览器设置中允许使用麦克风。");
        } else if (ev.error === "no-speech") {
          setMicHint("没有听到语音，请再试一次。");
        } else {
          setMicHint("语音识别出错，请改用文字输入。");
        }
        stopRecognition();
      };
      rec.onend = () => {
        setListening(false);
        recRef.current = null;
      };
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setMicHint("无法启动语音识别。");
      setListening(false);
    }
  }, [listening, stopRecognition]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  useEffect(() => {
    const skip = sessionStorage.getItem(SKIP_HOME_VIEW_KEY) === "1";
    if (skip) sessionStorage.removeItem(SKIP_HOME_VIEW_KEY);
    else void postStatsEvent({ kind: "view", scope: "home" });
    void refreshHomeStats();
  }, [refreshHomeStats]);

  useEffect(() => {
    if (hotExclusionsExhausted) clearUsedHotTerms();
  }, [hotExclusionsExhausted]);

  const pickRecommendedTerm = useCallback(
    (label: string) => {
      if (label === hotLabel) addUsedHotTerm(label);
      navigate(`/explain?term=${encodeURIComponent(label)}`);
    },
    [hotLabel, navigate]
  );

  return (
    <div className="animate-page-in flex min-h-svh flex-col px-4 pb-16 pt-[min(20vh,8rem)] sm:px-6">
      <header className="mb-10 text-center sm:mb-14">
        <h1 className="text-4xl font-light tracking-tight text-gray-800 sm:text-5xl">
          AI 术语普及
        </h1>
        <p className="mt-3 text-sm text-gray-500 sm:text-base">
          输入一个词，读懂专业说法与白话解释
        </p>
      </header>

      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmitTerm={submit}
        speechSupported={speechSupported}
        listening={listening}
        onMicClick={startRecognition}
        micHint={micHint}
      />

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-gray-400">
        按 Enter 搜索
      </p>

      <div className="mx-auto mt-8 w-full max-w-xl">
        <EngagementBar
          variant="home"
          views={homeStats.views}
          likes={homeStats.likes}
          shares={homeStats.shares}
          onRefresh={refreshHomeStats}
        />
      </div>

      <section className="mx-auto mt-12 w-full max-w-xl">
        <h2 className="mb-3 text-center text-sm font-medium text-gray-500">
          试试这些
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((label) => (
            <TermCard
              key={label}
              label={label}
              onPick={() => pickRecommendedTerm(label)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
