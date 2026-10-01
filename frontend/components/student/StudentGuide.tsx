"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export interface GuideSection {
  number: string;
  title: string;
  description: string;
  items?: string[];
}

interface StudentGuideProps {
  title: string;
  subtitle: string;
  sections: GuideSection[];
  continueLabel: string;
  continueHref: string;
}

export function StudentGuide({
  title,
  subtitle,
  sections,
  continueLabel,
  continueHref,
}: StudentGuideProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;

      const documentHeight =
        document.documentElement.scrollHeight -
        window.innerHeight;

      if (documentHeight <= 0) {
        setProgress(100);
        return;
      }

      const value = Math.round(
        (scrollTop / documentHeight) * 100
      );

      setProgress(Math.min(100, Math.max(0, value)));
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#0f1117]">

      {/* Top reading progress */}
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-slate-200 dark:bg-white/10">
        <div
          className="h-full bg-accent-600 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8">

        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Header */}
        <section className="mb-8">

          <div className="mb-3 inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
            Student Guide
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {title}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
            {subtitle}
          </p>

          {/* Progress */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Guide progress
              </span>

              <span className="text-xs font-semibold text-accent-600 dark:text-accent-400">
                {progress}%
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent-600 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {/* Guide content */}
        <div className="space-y-5">

          {sections.map((section) => (
            <Card
              key={section.number}
              className="overflow-hidden"
            >
              <CardContent className="p-0">

                <div className="flex gap-4 p-5 sm:gap-6 sm:p-7">

                  {/* Section number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-sm font-bold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                    {section.number}
                  </div>

                  <div className="min-w-0 flex-1">

                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
                      {section.title}
                    </h2>

                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
                      {section.description}
                    </p>

                    {section.items &&
                      section.items.length > 0 && (
                        <ul className="mt-5 space-y-3">

                          {section.items.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300"
                            >
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />

                              <span>{item}</span>
                            </li>
                          ))}

                        </ul>
                      )}

                  </div>
                </div>

              </CardContent>
            </Card>
          ))}

        </div>

        {/* Final continue card */}
        <Card className="mt-8 overflow-hidden border-accent-100 dark:border-accent-500/20">

          <CardContent className="p-6 text-center sm:p-8 lg:p-10">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              You&apos;re ready!
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
              You have reached the end of this guide. Continue to the
              section when you are ready.
            </p>

            <Button
              size="lg"
              className="mt-6"
              onClick={() => router.push(continueHref)}
            >
              {continueLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>

          </CardContent>

        </Card>

      </div>
    </main>
  );
}
