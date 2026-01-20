#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/dx/enterprise-ds/demo.ts
/**
 * Enterprise design system demo app.
 *
 * Run:
 *   deno run -A --unstable-bundle support/dx/enterprise-ds/demo.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */

import { fromFileUrl, isAbsolute } from "@std/path";
import { Application } from "../../../lib/continuux/http.ts";
import {
  a,
  defaultEnterpriseDesignSystem,
  enterpriseLayout,
  p,
  render,
  section,
  span,
} from "../../../lib/design-system/enterprise.ts";
import {
  div,
  form,
  h2,
  h3,
  input,
  label,
  li,
  option,
  scriptJs,
  select,
  table,
  tbody,
  td,
  th,
  thead,
  tr,
  ul,
} from "../../../lib/universal/fluent-html.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});

const ds = defaultEnterpriseDesignSystem;

const headerNav = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard", active: true },
  { label: "Data Table", href: "/users" },
  { label: "Forms", href: "/form" },
  { label: "Components", href: "/details" },
];

const sidebarSubjects = [
  { id: "admin", label: "Administration", active: true },
  { id: "analytics", label: "Analytics" },
  { id: "operations", label: "Operations" },
  { id: "settings", label: "Settings" },
];

const sidebarSections = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", active: true },
      { label: "Activity Feed", href: "/activity" },
    ],
  },
  {
    id: "user-management",
    label: "User Management",
    items: [
      { label: "Users", href: "/users" },
      { label: "Teams", href: "/teams" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Audit Logs", href: "/audit" },
      { label: "Security", href: "/security" },
    ],
  },
];

const footerLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Support", href: "/support" },
];

const footerStatus = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "Latency", value: "124ms", tone: "info" as const },
  { label: "Queue", value: "Normal", tone: "muted" as const },
];

function pageLayout(args: {
  title: string;
  description?: string;
  actions?: ReturnType<typeof div>;
  body: ReturnType<typeof section> | ReturnType<typeof div>;
  pathname: string;
}) {
  return enterpriseLayout(
    {
      title: `${args.title} | Enterprise DS Demo`,
      head: () =>
        scriptJs(
          `
document.addEventListener("DOMContentLoaded", () => {
  const shell = document.querySelector(".eds-shell");
  const toggle = document.querySelector("[data-eds-toggle='sidebar']");
  if (toggle && shell) {
    toggle.addEventListener("click", () => {
      const isCollapsed = shell.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    });
  }

  document.querySelectorAll(".eds-subject-menu").forEach((menu) => {
    const label = menu.querySelector(".eds-subject-label");
    const options = menu.querySelectorAll(".eds-subject-option");
    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((btn) => btn.classList.remove("is-active"));
        option.classList.add("is-active");
        if (label) {
          const nextLabel = option.getAttribute("data-label") || "";
          label.textContent = nextLabel;
        }
        menu.removeAttribute("open");
      });
    });
  });
});
          `.trim(),
        ),
      shell: ({ header, sidebar, content, rightRail, footer }) => ({
        header: header.use("enterprise", {
          brand: {
            appName: "Enterprise",
            href: "/",
            environment: "dev",
            logo: "E",
          },
          nav: headerNav.map((item) => ({
            ...item,
            active: item.href === args.pathname,
          })),
          actions: [
            form(
              { class: "eds-header-search", role: "search" },
              label({ class: "eds-sr-only", for: "header-search" }, "Search"),
              input({
                id: "header-search",
                type: "search",
                placeholder: "Search...",
              }),
              span({ class: "eds-search-shortcut" }, "⌘K"),
            ),
            a({ href: "/notifications", class: "eds-icon-button" }, "🔔"),
            a({ href: "/settings", class: "eds-icon-button" }, "⚙"),
            a({ href: "/profile" }, "John Doe"),
          ],
          breadcrumbs: [
            { label: "Home", href: "/" },
            { label: args.title },
          ],
        }),
        sidebar: sidebar.use("enterprise", {
          subjects: sidebarSubjects,
          sections: sidebarSections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
              ...item,
              active: item.href === args.pathname,
            })),
          })),
          footer: p("System status: nominal"),
        }),
        content: content.use("standard", {
          pageTitle: args.title,
          description: args.description ? p(args.description) : undefined,
          actions: args.actions ? [args.actions] : [
            a({ href: "/reports" }, "Download Report"),
            a({ href: "/export", class: "eds-action-primary" }, "Export"),
          ],
          body: args.body,
        }),
        rightRail: rightRail.use("sections", {
          title: "On this page",
          items: [
            {
              id: "overview",
              label: "Key Metrics",
              href: "#overview",
              active: true,
            },
            { id: "details", label: "Charts", href: "#details" },
            { id: "activity", label: "Recent Activity", href: "#activity" },
            { id: "tasks", label: "Tasks", href: "#tasks" },
          ],
          body: section(
            { class: "eds-rail-panel" },
            section(
              { class: "eds-rail-panel-header" },
              span({}, "Quick Actions"),
            ),
            section(
              { class: "eds-rail-panel-body eds-quick-actions" },
              a(
                { href: "/report", class: "eds-quick-action" },
                "Create Report",
              ),
              a(
                { href: "/meeting", class: "eds-quick-action" },
                "Schedule Meeting",
              ),
              a({ href: "/export", class: "eds-quick-action" }, "Export Data"),
            ),
          ),
        }),
        footer: footer.use("enterprise", {
          links: footerLinks,
          status: footerStatus,
          version: "v3.2.1",
          smallPrint: "(c) 2026 Junxion",
        }),
      }),
    },
    ds,
  );
}

const dashboardBody = section(
  { id: "overview" },
  div(
    { class: "eds-card-grid" },
    section(
      { class: "eds-section eds-metric-card" },
      span({ class: "eds-metric-icon" }, "$"),
      span({ class: "eds-metric-label" }, "Total Revenue"),
      span({ class: "eds-metric-value" }, "$45,231.89"),
      span({ class: "eds-metric-delta" }, "▲ 20.1% from last month"),
    ),
    section(
      { class: "eds-section eds-metric-card" },
      span({ class: "eds-metric-icon" }, "👥"),
      span({ class: "eds-metric-label" }, "Active Users"),
      span({ class: "eds-metric-value" }, "2,350"),
      span({ class: "eds-metric-delta" }, "▲ 180.1% from last month"),
    ),
    section(
      { class: "eds-section eds-metric-card" },
      span({ class: "eds-metric-icon" }, "🛒"),
      span({ class: "eds-metric-label" }, "Orders"),
      span({ class: "eds-metric-value" }, "+12,234"),
      span({ class: "eds-metric-delta" }, "▲ 19% from last month"),
    ),
    section(
      { class: "eds-section eds-metric-card" },
      span({ class: "eds-metric-icon" }, "⚡"),
      span({ class: "eds-metric-label" }, "Active Now"),
      span({ class: "eds-metric-value" }, "+573"),
      span(
        { class: "eds-metric-delta is-negative" },
        "▼ 2.5% since last hour",
      ),
    ),
  ),
  div(
    { id: "details", class: "eds-chart-grid" },
    section(
      { class: "eds-section" },
      h3({}, "Revenue Overview"),
      p("Monthly revenue trend for the current year."),
      div({ class: "eds-chart-placeholder" }, "Chart Area"),
    ),
    section(
      { class: "eds-section" },
      h3({}, "Orders by Month"),
      p("Order volume distribution."),
      div(
        { class: "eds-bar-chart" },
        ...[86, 62, 40, 58, 46, 52, 74].map((height) =>
          div({ class: "eds-bar", style: `height:${height}%;` })
        ),
      ),
    ),
  ),
  section(
    { id: "activity", class: "eds-section" },
    div(
      { style: "display:flex; justify-content:space-between; gap:12px;" },
      h3({}, "Recent Activity"),
      a({ href: "/activity" }, "View all"),
    ),
    div(
      {},
      div(
        { class: "eds-activity-item" },
        span({}, "Sarah Chen created a new order #ORD-7892"),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "2 min ago"),
      ),
      div(
        { class: "eds-activity-item" },
        span({}, "Mike Johnson updated permissions Admin Role"),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "15 min ago"),
      ),
      div(
        { class: "eds-activity-item" },
        span({}, "Emily Davis deployed changes to Production"),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "1 hour ago"),
      ),
    ),
  ),
  section(
    { id: "tasks", class: "eds-section" },
    h3({}, "Project Progress"),
    p("Current sprint task completion."),
    div(
      { style: "display:grid; gap:12px;" },
      div(
        { style: "display:flex; align-items:center; gap:12px;" },
        span({ style: "min-width:120px; font-weight:600;" }, "Design System"),
        div(
          {
            style:
              "flex:1; height:8px; background:#eef2f7; border-radius:999px; overflow:hidden;",
          },
          div({
            style:
              "height:100%; width:85%; background:#5b61f6; border-radius:999px;",
          }),
        ),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "85%"),
      ),
      div(
        { style: "display:flex; align-items:center; gap:12px;" },
        span({ style: "min-width:120px; font-weight:600;" }, "API Integration"),
        div(
          {
            style:
              "flex:1; height:8px; background:#eef2f7; border-radius:999px; overflow:hidden;",
          },
          div({
            style:
              "height:100%; width:62%; background:#f59e0b; border-radius:999px;",
          }),
        ),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "62%"),
      ),
      div(
        { style: "display:flex; align-items:center; gap:12px;" },
        span({ style: "min-width:120px; font-weight:600;" }, "User Testing"),
        div(
          {
            style:
              "flex:1; height:8px; background:#eef2f7; border-radius:999px; overflow:hidden;",
          },
          div({
            style:
              "height:100%; width:45%; background:#22c55e; border-radius:999px;",
          }),
        ),
        span({ style: "color:#8a95a5; font-size:0.85rem;" }, "45%"),
      ),
    ),
  ),
);

const usersBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    div(
      { style: "display:flex; gap:12px; flex-wrap:wrap;" },
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Search"),
        input({ type: "search", placeholder: "Search users..." }),
      ),
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Status"),
        select(
          {},
          option({ value: "all" }, "All"),
          option({ value: "active" }, "Active"),
          option({ value: "inactive" }, "Inactive"),
        ),
      ),
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Role"),
        select(
          {},
          option({ value: "all" }, "All"),
          option({ value: "admin" }, "Admin"),
          option({ value: "analyst" }, "Analyst"),
        ),
      ),
    ),
  ),
  section(
    { class: "eds-section" },
    table(
      { style: "width:100%; border-collapse: collapse;" },
      thead(
        {},
        tr(
          {},
          th({ style: "text-align:left; padding:8px;" }, "Name"),
          th({ style: "text-align:left; padding:8px;" }, "Status"),
          th({ style: "text-align:left; padding:8px;" }, "Role"),
          th({ style: "text-align:left; padding:8px;" }, "Last Active"),
        ),
      ),
      tbody(
        {},
        [
          ["Jordan Lee", "Active", "Admin", "2 hours ago"],
          ["Casey Tran", "Active", "Analyst", "Yesterday"],
          ["Morgan Ellis", "Inactive", "Operator", "3 days ago"],
          ["Taylor Reed", "Active", "Viewer", "Today"],
        ].map((row) =>
          tr(
            {},
            row.map((cell) =>
              td({ style: "padding:8px; border-top: 1px solid #dbe1ea;" }, cell)
            ),
          )
        ),
      ),
    ),
  ),
);

const detailBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    div(
      { style: "display:flex; gap:16px; align-items:flex-start;" },
      span(
        {
          style:
            "display:inline-flex; width:56px; height:56px; border-radius:50%; background:#2563eb; color:#fff; align-items:center; justify-content:center; font-weight:700;",
        },
        "JD",
      ),
      div(
        {},
        h2({}, "Jordan Doe"),
        p("jordan.doe@example.com"),
        div(
          { style: "display:flex; gap:8px; flex-wrap:wrap;" },
          span({ style: "padding:4px 10px; background:#e0f2fe;" }, "Active"),
          span({ style: "padding:4px 10px; background:#fef3c7;" }, "Gold"),
        ),
      ),
    ),
  ),
  section(
    { id: "details", class: "eds-section" },
    h3({}, "Details"),
    ul(
      {},
      [
        li({}, "Region: North America"),
        li({}, "Account: Enterprise Plus"),
        li({}, "Last ticket: 4 days ago"),
      ],
    ),
  ),
  section(
    { id: "activity", class: "eds-section" },
    h3({}, "Activity"),
    ul(
      {},
      [
        li({}, "Submitted onboarding survey."),
        li({}, "Updated billing address."),
        li({}, "Requested API access."),
      ],
    ),
  ),
);

const formBody = section(
  { id: "overview" },
  form(
    {},
    section(
      { class: "eds-section" },
      h3({}, "Basic Information"),
      div(
        { style: "display:grid; gap:12px; grid-template-columns: 1fr 1fr;" },
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Project name"),
          input({ type: "text", placeholder: "New project" }),
        ),
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Owner"),
          input({ type: "text", placeholder: "Owner name" }),
        ),
      ),
    ),
    section(
      { class: "eds-section" },
      h3({}, "Settings"),
      div(
        { style: "display:grid; gap:12px; grid-template-columns: 1fr 1fr;" },
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Environment"),
          select(
            {},
            option({ value: "dev" }, "Development"),
            option({ value: "stage" }, "Staging"),
            option({ value: "prod" }, "Production"),
          ),
        ),
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Region"),
          select(
            {},
            option({ value: "na" }, "North America"),
            option({ value: "eu" }, "Europe"),
            option({ value: "apac" }, "APAC"),
          ),
        ),
      ),
    ),
    div(
      { style: "display:flex; justify-content:flex-end; gap:8px;" },
      a({ href: "#" }, "Cancel"),
      a({ href: "#" }, "Create"),
    ),
  ),
);

const settingsBody = section(
  { id: "overview", style: "display:flex; gap:24px;" },
  section(
    { class: "eds-section", style: "width:220px; flex-shrink:0;" },
    ul(
      {},
      [
        li({}, a({ href: "/settings#profile" }, "Profile")),
        li({}, a({ href: "/settings#appearance" }, "Appearance")),
        li({}, a({ href: "/settings#notifications" }, "Notifications")),
      ],
    ),
  ),
  div(
    { style: "display:grid; gap:16px; flex:1;" },
    section(
      { id: "profile", class: "eds-section" },
      h3({}, "Profile Settings"),
      p("Update personal information and role assignments."),
    ),
    section(
      { id: "appearance", class: "eds-section" },
      h3({}, "Appearance"),
      p("Adjust theme preferences and density."),
    ),
    section(
      { id: "notifications", class: "eds-section" },
      h3({}, "Notifications"),
      p("Configure alerts for activity and system events."),
    ),
  ),
);

const marketingBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    h2({}, "Enterprise Operations, Unified"),
    p(
      "Build workflows, monitor operations, and align teams with a single enterprise workspace.",
    ),
    div(
      { style: "display:flex; gap:8px; flex-wrap:wrap;" },
      a({ href: "/demo" }, "Request demo"),
      a({ href: "/pricing" }, "View pricing"),
    ),
  ),
  div(
    {
      style:
        "display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));",
    },
    ...["Visibility", "Governance", "Automation"].map((titleText) =>
      section(
        { class: "eds-section" },
        h3({}, titleText),
        p("Short value statement for enterprise teams."),
      )
    ),
  ),
);

function htmlFor(pathname: string) {
  switch (pathname) {
    case "/":
    case "/dashboard":
      return render(
        pageLayout({
          title: "Dashboard",
          description: "Welcome back, John. Here's what's happening today.",
          body: dashboardBody,
          pathname,
        }).html,
      );
    case "/users":
      return render(
        pageLayout({
          title: "Users",
          description: "Search, filter, and manage enterprise users.",
          body: usersBody,
          pathname,
        }).html,
      );
    case "/details":
      return render(
        pageLayout({
          title: "Account Details",
          description: "Customer profile and engagement insights.",
          body: detailBody,
          pathname,
        }).html,
      );
    case "/form":
      return render(
        pageLayout({
          title: "Create Project",
          description: "Capture the details for a new enterprise project.",
          body: formBody,
          pathname,
        }).html,
      );
    case "/settings":
      return render(
        pageLayout({
          title: "Settings",
          description: "Manage profile, theme, and notification settings.",
          body: settingsBody,
          pathname,
        }).html,
      );
    case "/marketing":
      return render(
        pageLayout({
          title: "Overview",
          description: "Marketing variant content in the enterprise shell.",
          body: marketingBody,
          pathname,
        }).html,
      );
    default:
      return render(
        pageLayout({
          title: "Not Found",
          description: "The requested page could not be found.",
          body: section(
            { class: "eds-section" },
            h3({}, "404"),
            p("Try the dashboard, users, or settings pages."),
          ),
          pathname,
        }).html,
      );
  }
}

const fileResponse = async (
  path: string,
  contentType: string,
  headers?: HeadersInit,
) =>
  new Response(await Deno.readTextFile(path), {
    headers: { "content-type": contentType, ...(headers ?? {}) },
  });

app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

const layoutDeps = Array.from(
  pageLayout({ title: "Dashboard", body: dashboardBody, pathname: "/" })
    .dependencies,
);
for (const dep of layoutDeps) {
  if (dep.source.startsWith("http://") || dep.source.startsWith("https://")) {
    continue;
  }
  const mountPath = dep.mount;
  const filePath = dep.source.startsWith("file://")
    ? fromFileUrl(dep.source)
    : isAbsolute(dep.source)
    ? dep.source
    : "";
  if (!filePath) continue;
  const contentType = dep.contentType ?? "application/octet-stream";
  app.get(mountPath, () => fileResponse(filePath, contentType, dep.headers));
}

app.get("*", (c) =>
  new Response(htmlFor(new URL(c.req.url).pathname), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.serve();
