import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";

/**
 * One raw exchange: no redirect followed, no body decoded, no cookie jar. The check compares bytes, so it asks for
 * `identity` and reads exactly what came back.
 */
export type Exchange = { status: number; headers: IncomingHttpHeaders; body: Buffer };

export type Send = (input: {
  host: string;
  target: string;
  method?: "GET" | "HEAD" | "POST";
  headers?: Record<string, string>;
  body?: string;
}) => Promise<Exchange>;

/**
 * Sends over HTTPS to the host itself, or, when `origin` is given (the tests' local gate), over plain HTTP to that
 * origin with the host in the Host header. Times out after 20 seconds rather than hanging a scheduled run.
 */
export const createSend =
  (origin?: string): Send =>
  ({ host, target, method = "GET", headers = {}, body }) =>
    new Promise((resolve, reject) => {
      const local = origin ? new URL(origin) : undefined;
      const request = (local ? httpRequest : httpsRequest)(
        {
          host: local ? local.hostname : host,
          port: local ? Number(local.port) : 443,
          servername: local ? undefined : host,
          method,
          path: target,
          headers: {
            Host: host,
            "Accept-Encoding": "identity",
            "User-Agent": "crv-leak-check",
            ...(body !== undefined && { "Content-Length": String(Buffer.byteLength(body)) }),
            ...headers,
          },
          timeout: 20_000,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () =>
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
          );
          response.on("error", reject);
        },
      );
      request.on("timeout", () => request.destroy(new Error(`${method} ${host}${target} timed out`)));
      request.on("error", reject);
      request.end(body);
    });

/** A header's value as one string, or "" when absent. */
export const header = (exchange: Exchange, name: string): string => {
  const value = exchange.headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
};

/** Every `Set-Cookie` the response carried. */
export const setCookies = (exchange: Exchange): string[] => {
  const value = exchange.headers["set-cookie"];
  return Array.isArray(value) ? value : value ? [value] : [];
};
