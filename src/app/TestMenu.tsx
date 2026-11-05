import { appVersion } from "@/core/release";
import { isMock } from "@/core/api";
import { mockReset } from "@/core/api/mock";

/** Internal only. Compiled out of release builds via __RELEASE__ (see vite.config.ts). */
export function TestMenu() {
  return (
    <div className="testmenu">
      <span>DEV v{appVersion} {isMock ? "MOCK" : "LIVE"}</span>
      {isMock && <button onClick={() => { mockReset(); location.reload(); }}>Reset</button>}
    </div>
  );
}
