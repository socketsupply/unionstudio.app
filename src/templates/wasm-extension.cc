#include <socket/extension.h>

static bool initialize (sapi_context_t* context, const void* data) {
  sapi_log(ctx: context, message: "from wasm");

  sapi_javascript_evaluate(context, name: "foo", source: "console.log('hello world!')");

  sapi_log(ctx: context, message: sapi_env_get(context, name: "HOME"));

  sapi_context_dispatch(context, data: NULL, callback: [](sapi_context_t* context, const void* data)-> void {
    sapi_log(ctx: context, message: "dispatched callback");
  });

  return true;
}

SOCKET_RUNTIME_REGISTER_EXTENSION(
  .name="wasm",
  .initializer=initialize,
  NULL,
  .description="A native extension compiled to WASM",
  .version="0.0.1"
);
