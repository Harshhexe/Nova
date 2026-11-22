#include <cstdio>
#include <cstring>
#include <cerrno>
#include <node_api.h>
#include <vector>

napi_value SwapAppBundles(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc != 2) {
    napi_throw_type_error(env, nullptr, "Expected two application bundle paths");
    return nullptr;
  }
  std::vector<char> paths[2];
  for (size_t i = 0; i < argc; ++i) {
    size_t size;
    if (napi_get_value_string_utf8(env, args[i], nullptr, 0, &size) != napi_ok || size == 0) {
      napi_throw_type_error(env, nullptr, "Expected application bundle paths");
      return nullptr;
    }
    paths[i].resize(size + 1);
    napi_get_value_string_utf8(env, args[i], paths[i].data(), paths[i].size(), nullptr);
  }
  if (renamex_np(paths[0].data(), paths[1].data(), RENAME_SWAP) != 0) {
    napi_throw_error(env, nullptr, std::strerror(errno));
  }
  return nullptr;
}
