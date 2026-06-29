import { useEffect, useState } from "react";

export type TabLockStatus = "checking" | "acquired" | "blocked";

export function useTabLock(lockName: string): TabLockStatus {
  const [status, setStatus] = useState<TabLockStatus>("checking");

  useEffect(() => {
    // Web Locks API not supported (e.g. older mobile browsers) — skip guard
    if (!navigator.locks) {
      setStatus("acquired");
      return;
    }

    const abortController = new AbortController();

    const acquireLock = async () => {
      let acquiredImmediately = false;

      try {
        // 1. 第一次嘗試：不排隊，立即檢查 (不使用 signal)
        await navigator.locks.request(
          lockName,
          { ifAvailable: true },
          async (lock) => {
            if (abortController.signal.aborted) return;

            if (lock) {
              // 成功取得鎖
              acquiredImmediately = true;
              setStatus("acquired");
              
              // 回傳一個 pending 的 Promise 來佔住這個鎖，直到組件卸載觸發 abort
              return new Promise<void>((resolve) => {
                abortController.signal.addEventListener("abort", () => resolve());
              });
            }
          }
        );

        // 如果上面沒有立刻取得鎖，代表已經有別的分頁佔用了，且組件還沒被卸載
        if (!acquiredImmediately && !abortController.signal.aborted) {
          setStatus("blocked");

          // 2. 第二次嘗試：進入「排隊等待」模式 (這裡允許且需要使用 signal)
          await navigator.locks.request(
            lockName,
            { signal: abortController.signal },
            async (lock) => {
              if (abortController.signal.aborted) return;
              
              // 等到了！前一個分頁已關閉，現在由我們接手
              setStatus("acquired");
              
              return new Promise<void>((resolve) => {
                abortController.signal.addEventListener("abort", () => resolve());
              });
            }
          );
        }
      } catch (err: any) {
        // 忽略因為組件正常卸載而引發的 AbortError
        if (err.name !== "AbortError") {
          console.error("Tab lock error:", err);
        }
      }
    };

    acquireLock();

    return () => {
      // 組件卸載時，觸發 abort：
      // 1. 如果正在排隊，會取消排隊 (捕捉並忽略 AbortError)
      // 2. 如果已經持有鎖，會觸發 abort 事件讓 Promise resolve，從而釋放鎖
      abortController.abort();
    };
  }, [lockName]);

  return status;
}