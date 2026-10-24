
"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "tma-results-scroll";

export default function ResultsScrollKeeper({
  roundId,
}: {
  roundId: string;
}) {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  useEffect(() => {
    function rememberScroll(event: SubmitEvent) {
      const target = event.target;

      if (!(target instanceof HTMLFormElement)) {
        return;
      }

      if (!target.closest("[data-results-editor]")) {
        return;
      }

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          roundId,
          pathname: window.location.pathname,
          y: window.scrollY,
        })
      );
    }

    document.addEventListener(
      "submit",
      rememberScroll,
      true
    );

    return () => {
      document.removeEventListener(
        "submit",
        rememberScroll,
        true
      );
    };
  }, [roundId]);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);

    if (!saved || !message) {
      return;
    }

    try {
      const position = JSON.parse(saved) as {
        roundId: string;
        pathname: string;
        y: number;
      };

      if (
        position.roundId !== roundId ||
        position.pathname !== window.location.pathname
      ) {
        return;
      }

      sessionStorage.removeItem(STORAGE_KEY);

      // Restore after the updated page has rendered.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({
            top: position.y,
            behavior: "instant",
          });
        });
      });
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [roundId, message]);

  return null;
}
