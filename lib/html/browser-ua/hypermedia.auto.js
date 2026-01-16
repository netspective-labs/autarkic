// lib/html/hypermedia.ts
var action = (method, uri) => ({
  __hxAction: true,
  method,
  uri
});
var q = (s) => JSON.stringify(s);
var toActionExpr = (a) => `@${a.method}(${q(a.uri)})`;
var on = (eventName, a) => ({
  [`data-on:${eventName}`]: toActionExpr(a)
});
var onClick = (a) => on("click", a);
var onSubmit = (a) => on("submit", a);
var onLoad = (a) => on("load", a);
var get = (uri) => action("get", uri);
var post = (uri) => action("post", uri);
var put = (uri) => action("put", uri);
var patch = (uri) => action("patch", uri);
var del = (uri) => action("delete", uri);
var clickGet = (uri) => onClick(get(uri));
var clickPost = (uri) => onClick(post(uri));
var loadGet = (uri) => onLoad(get(uri));
var signals = (obj) => ({
  "data-signals": JSON.stringify(obj)
});
var bind = (path) => ({
  [`data-bind:${path}`]: ""
});
var text = (expr) => ({
  "data-text": expr
});
var show = (expr) => ({
  "data-show": expr
});
var effect = (expr) => ({
  "data-effect": expr
});
var classIf = (clsName, expr) => ({
  [`data-class:${clsName}`]: expr
});
var attr = (attrName, expr) => ({
  [`data-attr:${attrName}`]: expr
});
var headers = {
  selector: "datastar-selector",
  mode: "datastar-mode",
  useViewTransition: "datastar-use-view-transition",
  onlyIfMissing: "datastar-only-if-missing",
  request: "Datastar-Request"
};
var JunxionUX = {
  on,
  onClick,
  onSubmit,
  onLoad,
  get,
  post,
  put,
  patch,
  delete: del,
  clickGet,
  clickPost,
  loadGet,
  signals,
  bind,
  text,
  show,
  effect,
  classIf,
  attr,
  headers
};
export {
  JunxionUX,
  attr,
  bind,
  classIf,
  clickGet,
  clickPost,
  del,
  effect,
  get,
  headers,
  loadGet,
  on,
  onClick,
  onLoad,
  onSubmit,
  patch,
  post,
  put,
  show,
  signals,
  text,
  toActionExpr
};
