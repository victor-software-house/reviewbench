import { render } from "@opentui/solid";
import { App } from "./app/App";
import { loadProjectShell } from "./app/project";

export { App } from "./app/App";
export { loadProjectShell } from "./app/project";

if (import.meta.main) {
  const project = loadProjectShell(process.argv[2]);
  await render(() => <App {...project} />, {
    useMouse: true,
    enableMouseMovement: true,
    exitOnCtrlC: false,
    targetFps: 30,
  });
}
