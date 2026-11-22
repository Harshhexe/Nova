#import <AppKit/AppKit.h>
#include <node_api.h>

napi_value RequestDefaultBrowser(napi_env env, napi_callback_info info);
napi_value SwapAppBundles(napi_env env, napi_callback_info info);

static id monitor;
static napi_ref listener;

static napi_value Start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value callback;
  napi_get_cb_info(env, info, &argc, &callback, nullptr, nullptr);
  if (monitor || argc != 1) return nullptr;
  napi_create_reference(env, callback, 1, &listener);
  __block double magnification = 0;
  __block bool pinchTriggered = false;
  monitor = [NSEvent addLocalMonitorForEventsMatchingMask:(NSEventMaskScrollWheel | NSEventMaskMagnify)
    handler:^NSEvent *(NSEvent *event) {
      const char *phase = nullptr;
      if (event.type == NSEventTypeMagnify) {
        if (event.phase == NSEventPhaseBegan) {
          magnification = 0;
          pinchTriggered = false;
        }
        if (event.phase == NSEventPhaseCancelled) return event;
        magnification += event.magnification;
        if (!pinchTriggered && (magnification <= -0.12 || magnification >= 0.12)) {
          pinchTriggered = true;
          phase = magnification < 0 ? "pinch-in" : "pinch-out";
        }
      } else {
        if (event.momentumPhase != NSEventPhaseNone) return event;
        if (event.phase == NSEventPhaseBegan) phase = "begin";
        else if (event.phase == NSEventPhaseEnded) phase = "release";
        else if (event.phase == NSEventPhaseCancelled) phase = "cancel";
      }
      if (!phase) return event;

      napi_handle_scope scope;
      if (napi_open_handle_scope(env, &scope) != napi_ok) return event;
      napi_value fn, receiver, argument;
      napi_get_reference_value(env, listener, &fn);
      napi_get_undefined(env, &receiver);
      napi_create_string_utf8(env, phase, NAPI_AUTO_LENGTH, &argument);
      napi_call_function(env, receiver, fn, 1, &argument, nullptr);
      napi_close_handle_scope(env, scope);
      return event;
    }];
  napi_add_env_cleanup_hook(env, [](void *) {
    if (monitor) [NSEvent removeMonitor:monitor];
    monitor = nil;
  }, nullptr);
  return nullptr;
}

NAPI_MODULE_INIT() {
  napi_value start;
  napi_create_function(env, "start", NAPI_AUTO_LENGTH, Start, nullptr, &start);
  napi_set_named_property(env, exports, "start", start);
  napi_value requestDefaultBrowser;
  napi_create_function(env, "requestDefaultBrowser", NAPI_AUTO_LENGTH, RequestDefaultBrowser, nullptr, &requestDefaultBrowser);
  napi_set_named_property(env, exports, "requestDefaultBrowser", requestDefaultBrowser);
  napi_value swapAppBundles;
  napi_create_function(env, "swapAppBundles", NAPI_AUTO_LENGTH, SwapAppBundles, nullptr, &swapAppBundles);
  napi_set_named_property(env, exports, "swapAppBundles", swapAppBundles);
  return exports;
}
