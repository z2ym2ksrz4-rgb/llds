import { useEffect } from "react";
import { create } from "zustand";

/** "Scene": the current screen's hero picture, blurred and dimmed, fixed behind the whole page (plus a faint gold line pattern).
 *  Screens call useScene(url); <SceneBg/> is mounted once in the shell. Gives depth without noise – content sits on glass panels. */
type SceneState = { url: string | null; set: (u: string | null) => void };
export const useSceneStore = create<SceneState>((set) => ({ url: null, set: (url) => set({ url }) }));

export function useScene(url: string | null | undefined) {
  const set = useSceneStore((s) => s.set);
  useEffect(() => { set(url ?? null); return () => set(null); }, [url, set]);
}

export function SceneBg() {
  const url = useSceneStore((s) => s.url);
  return <><div className={"scene-bg" + (url ? " on" : "")} aria-hidden="true" style={url ? { backgroundImage: `url(${url})` } : undefined} /><div className="sideband" aria-hidden="true" /></>;
}
