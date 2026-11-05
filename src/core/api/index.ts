import appConfig from "../../../app.config.json";
import { mockApi } from "./mock";
import { supabaseApi } from "./supabase";
import type { Api } from "./types";

export * from "./types";

/** One API for the whole app. Supabase when keys are configured, otherwise the in-memory mock (dev, demo, smoke). */
const url = import.meta.env.VITE_SUPABASE_URL || appConfig.supabase.url;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || appConfig.supabase.anonKey;
export const isMock = !url || !key;
export const api: Api = isMock ? mockApi : supabaseApi(url, key);
