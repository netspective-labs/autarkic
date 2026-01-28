import type { Middleware, VarsRecord } from "../continuux/http.ts";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const METHOD_COLORS: Record<string, string> = {
  GET: ANSI.green,
  POST: ANSI.cyan,
  PUT: ANSI.yellow,
  PATCH: ANSI.magenta,
  DELETE: ANSI.red,
  OPTIONS: ANSI.blue,
  HEAD: ANSI.gray,
};

const DEFAULT_HEADER_KEYS = [
  "content-type",
  "accept",
  "user-agent",
  "referer",
  "x-request-id",
] as const;

export type ConsoleDiagnosticsMode =
  | "concise"
  | "intermediate"
  | "comprehensive";

export type ConsoleDiagnosticsAideOptions = {
  readonly mode?: ConsoleDiagnosticsMode;
  readonly color?: boolean;
  readonly headerKeys?: readonly string[];
};

type ResolvedConsoleDiagnosticsOptions =
  & Required<ConsoleDiagnosticsAideOptions>
  & {
    readonly headerKeys: readonly string[];
  };

export type ConsoleDiagnosticsAide<
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
> = {
  readonly middleware: Middleware<State, Vars>;
  readonly options: ResolvedConsoleDiagnosticsOptions;
};

const getStatusColor = (status: number) => {
  if (status >= 500) return ANSI.red;
  if (status >= 400) return ANSI.yellow;
  if (status >= 300) return ANSI.cyan;
  return ANSI.green;
};

const getDurationColor = (ms: number) =>
  ms > 500 ? ANSI.yellow : ms > 250 ? ANSI.magenta : ANSI.dim;

const colorize = (text: string, color: string, enabled: boolean) =>
  enabled ? `${color}${text}${ANSI.reset}` : text;

const formatPath = (url: URL, maxLength = 120) => {
  const full = `${url.pathname}${url.search ?? ""}`;
  if (full.length <= maxLength) return full;
  return `${full.slice(0, maxLength - 3)}...`;
};

type HeaderPair = {
  readonly key: string;
  readonly value: string;
};

const pickHeaders = (headers: Headers, keys: readonly string[]): HeaderPair[] =>
  keys
    .map((key) => {
      const value = headers.get(key);
      if (!value) return null;
      const cleaned = value.length > 80 ? `${value.slice(0, 77)}...` : value;
      return { key, value: cleaned };
    })
    .filter((entry): entry is HeaderPair => Boolean(entry));

const modeLabels: Record<ConsoleDiagnosticsMode, string> = {
  concise: "diag:concise",
  intermediate: "diag:intermediate",
  comprehensive: "diag:comprehensive",
};

const makeLabel = (mode: ConsoleDiagnosticsMode, color: boolean) =>
  color
    ? colorize(`[${modeLabels[mode]}]`, ANSI.dim, color)
    : `[${modeLabels[mode]}]`;

const formatKeyValue = (
  key: string,
  value: string,
  options: ResolvedConsoleDiagnosticsOptions,
  valueColor?: string,
) => {
  const keySegment = colorize(`${key}:`, ANSI.gray, options.color);
  const valueSegment = valueColor
    ? colorize(value, valueColor, options.color)
    : value;
  return `${keySegment} ${valueSegment}`;
};

export function consoleDiagnosticsAide<
  State extends Record<string, unknown> = Record<string, never>,
  Vars extends VarsRecord = VarsRecord,
>(
  options: ConsoleDiagnosticsAideOptions = {},
): ConsoleDiagnosticsAide<State, Vars> {
  const resolved: ResolvedConsoleDiagnosticsOptions = {
    mode: options.mode ?? "intermediate",
    color: options.color ?? true,
    headerKeys: options.headerKeys ?? DEFAULT_HEADER_KEYS,
  };

  const middleware: Middleware<State, Vars> = async (ctx, next) => {
    const url = new URL(ctx.req.url);
    const start = performance.now();
    try {
      const response = await next();
      const duration = performance.now() - start;
      logRequest(ctx, response, url, duration, resolved);
      return response;
    } catch (error) {
      const duration = performance.now() - start;
      logError(ctx, error, url, duration, resolved);
      throw error;
    }
  };

  return {
    middleware,
    options: resolved,
  };
}

const logRequest = <
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
>(
  ctx: Parameters<Middleware<State, Vars>>[0],
  res: Response,
  url: URL,
  duration: number,
  options: ResolvedConsoleDiagnosticsOptions,
) => {
  const label = makeLabel(options.mode, options.color);
  const methodColor = METHOD_COLORS[ctx.req.method] ?? ANSI.white;
  const methodSegment = colorize(ctx.req.method, methodColor, options.color);
  const pathSegment = colorize(formatPath(url), ANSI.cyan, options.color);
  const statusText = res.statusText ? ` ${res.statusText}` : "";
  const statusValue = `${res.status}${statusText}`;
  const durationValue = `${duration.toFixed(1)}ms`;
  const statusSegment = colorize(
    statusValue,
    getStatusColor(res.status),
    options.color,
  );
  const durationSegment = colorize(
    durationValue,
    getDurationColor(duration),
    options.color,
  );
  const query = url.searchParams.toString();
  const reqHeaders = pickHeaders(ctx.req.headers, options.headerKeys);
  const resHeaders = pickHeaders(res.headers, options.headerKeys);

  if (options.mode === "concise") {
    console.log(
      `${label} ${methodSegment} ${pathSegment} ${statusSegment} ${durationSegment}`,
    );
    return;
  }

  const detailLines: string[] = [];

  if (options.mode === "intermediate") {
    detailLines.push(`${label} ${methodSegment} ${pathSegment}`);
    detailLines.push(
      `  ${
        formatKeyValue(
          "status",
          statusValue,
          options,
          getStatusColor(res.status),
        )
      } · ${
        formatKeyValue(
          "duration",
          durationValue,
          options,
          getDurationColor(duration),
        )
      } · ${formatKeyValue("id", ctx.requestId, options, ANSI.gray)}`,
    );
    if (query) {
      detailLines.push(
        `  ${formatKeyValue("query", query, options, ANSI.cyan)}`,
      );
    }
    if (reqHeaders.length) {
      detailLines.push(
        `  req · ${
          reqHeaders
            .map((header) =>
              formatKeyValue(header.key, header.value, options, ANSI.cyan)
            )
            .join(" · ")
        }`,
      );
    }
    if (resHeaders.length) {
      detailLines.push(
        `  res · ${
          resHeaders
            .map((header) =>
              formatKeyValue(header.key, header.value, options, ANSI.cyan)
            )
            .join(" · ")
        }`,
      );
    }
    console.log(detailLines.join("\n"));
    return;
  }

  const comprehensiveLines: string[] = [];
  comprehensiveLines.push(`${label} ${methodSegment} ${pathSegment}`);
  comprehensiveLines.push(
    `  ${
      formatKeyValue("host", url.host || "<unknown>", options, ANSI.magenta)
    }`,
  );
  comprehensiveLines.push(
    `  ${
      formatKeyValue(
        "status",
        statusValue,
        options,
        getStatusColor(res.status),
      )
    }`,
  );
  comprehensiveLines.push(
    `  ${
      formatKeyValue(
        "duration",
        durationValue,
        options,
        getDurationColor(duration),
      )
    }`,
  );
  comprehensiveLines.push(
    `  ${formatKeyValue("request id", ctx.requestId, options, ANSI.gray)}`,
  );
  comprehensiveLines.push(
    `  ${
      formatKeyValue("started", new Date().toISOString(), options, ANSI.blue)
    }`,
  );
  comprehensiveLines.push(
    `  ${
      formatKeyValue(
        "query",
        query || "<none>",
        options,
        ANSI.cyan,
      )
    }`,
  );
  if (reqHeaders.length) {
    const headerLine = reqHeaders
      .map((header) =>
        formatKeyValue(header.key, header.value, options, ANSI.cyan)
      )
      .join(" · ");
    comprehensiveLines.push(
      `  ${
        colorize("request headers:", ANSI.gray, options.color)
      } ${headerLine}`,
    );
  }
  if (resHeaders.length) {
    const headerLine = resHeaders
      .map((header) =>
        formatKeyValue(header.key, header.value, options, ANSI.cyan)
      )
      .join(" · ");
    comprehensiveLines.push(
      `  ${
        colorize("response headers:", ANSI.gray, options.color)
      } ${headerLine}`,
    );
  }
  console.log(comprehensiveLines.join("\n"));
};

const logError = <
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
>(
  ctx: Parameters<Middleware<State, Vars>>[0],
  error: unknown,
  url: URL,
  duration: number,
  options: ResolvedConsoleDiagnosticsOptions,
) => {
  const label = makeLabel(options.mode, options.color);
  const methodColor = METHOD_COLORS[ctx.req.method] ?? ANSI.white;
  const methodSegment = colorize(ctx.req.method, methodColor, options.color);
  const pathSegment = colorize(formatPath(url), ANSI.cyan, options.color);
  const durationSegment = colorize(
    `${duration.toFixed(1)}ms`,
    getDurationColor(duration),
    options.color,
  );
  const errorSegment = colorize("error", ANSI.red, options.color);
  console.error(
    `${label} ${methodSegment} ${pathSegment} ${errorSegment} ${durationSegment}`,
  );
  if (error instanceof Error) {
    console.error(`  ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(`  stack: ${error.stack.split("\n")[0]}`);
    }
  } else {
    console.error(`  %o`, error);
  }
};
