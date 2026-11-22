#import <AppKit/AppKit.h>
#include <node_api.h>

napi_value RequestDefaultBrowser(napi_env env, napi_callback_info) {
  napi_deferred deferred;
  napi_value promise, name;
  napi_create_promise(env, &deferred, &promise);
  napi_create_string_utf8(env, "NOVA default browser request", NAPI_AUTO_LENGTH, &name);

  napi_threadsafe_function completion;
  if (napi_create_threadsafe_function(env, nullptr, nullptr, name, 0, 1, nullptr, nullptr, deferred,
      [](napi_env callbackEnv, napi_value, void *context, void *success) {
        if (!callbackEnv) return;
        napi_value result;
        napi_get_boolean(callbackEnv, success != nullptr, &result);
        napi_resolve_deferred(callbackEnv, static_cast<napi_deferred>(context), result);
      }, &completion) != napi_ok) {
    napi_value result;
    napi_get_boolean(env, false, &result);
    napi_resolve_deferred(env, deferred, result);
    return promise;
  }
  napi_unref_threadsafe_function(env, completion);
  void (^finish)(BOOL) = ^(BOOL success) {
    napi_call_threadsafe_function(completion, success ? completion : nullptr, napi_tsfn_nonblocking);
    napi_release_threadsafe_function(completion, napi_tsfn_release);
  };

  NSURL *appURL = NSBundle.mainBundle.bundleURL;
  [NSWorkspace.sharedWorkspace setDefaultApplicationAtURL:appURL toOpenURLsWithScheme:@"http" completionHandler:^(NSError *error) {
    // After a decline, a second request could show another confirmation.
    if (error) {
      finish(NO);
      return;
    }
    [NSWorkspace.sharedWorkspace setDefaultApplicationAtURL:appURL toOpenURLsWithScheme:@"https" completionHandler:^(NSError *httpsError) {
      finish(httpsError == nil);
    }];
  }];
  return promise;
}
