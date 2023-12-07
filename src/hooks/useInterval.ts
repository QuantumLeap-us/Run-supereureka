import { useEffect, useRef } from "react";

import { sleep } from "@/utils/helper";

export default function useInterval(
  callback: (count: number) => Promise<void>,
  delay: number | null,
  fastMode: boolean = false,
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let isRunning = true;
    let count = 0;

    async function tick() {
      while (isRunning && delay !== null) {
        if (fastMode) {
          savedCallback.current(count);
        } else {
          await savedCallback.current(count);
        }
        await sleep(fastMode ? Math.max(delay, 100) : delay);
        count += 1;
      }
    }

    tick();

    return () => {
      isRunning = false;
    };
  }, [delay, fastMode]);
}
