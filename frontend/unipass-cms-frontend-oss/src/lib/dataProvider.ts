import simpleRestProvider from "ra-data-simple-rest";
import { fetchUtils } from "react-admin";

import { TOKEN_KEY } from "./auth";

/**
 * Build a react-admin DataProvider that attaches the stored JWT on
 * every request. `simpleRestProvider` honours `httpClient` for both
 * read and write paths, so this single hook covers GET/POST/PUT/DELETE.
 */
export function buildDataProvider(
  apiUrl: string,
  storage: Pick<Storage, "getItem"> = localStorage,
) {
  const httpClient = (url: string, options: fetchUtils.Options = {}) => {
    const headers = (options.headers as Headers | undefined) ?? new Headers({ Accept: "application/json" });
    const tok = storage.getItem(TOKEN_KEY);
    if (tok) headers.set("Authorization", `Bearer ${tok}`);
    return fetchUtils.fetchJson(url, { ...options, headers });
  };
  return simpleRestProvider(apiUrl, httpClient);
}

/**
 * Exposed for tests: the http-client factory, which is the only part
 * that contains non-vendor logic.
 */
export function buildHttpClient(storage: Pick<Storage, "getItem">) {
  return (url: string, options: fetchUtils.Options = {}) => {
    const headers = (options.headers as Headers | undefined) ?? new Headers({ Accept: "application/json" });
    const tok = storage.getItem(TOKEN_KEY);
    if (tok) headers.set("Authorization", `Bearer ${tok}`);
    return { url, headers };
  };
}
