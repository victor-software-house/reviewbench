import { render } from "@opentui/solid";
import { App } from "./app/App";
import { loadProjectShell } from "./app/project";
import { type ReviewbenchSessionRuntime, startReviewbenchSessionRuntime } from "./app/session";

if (import.meta.main) {
  const project = loadProjectShell(process.argv[2]);
  const configuredPort = Number.parseInt(process.env.HUNK_MCP_PORT ?? "", 10);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 47_657;
  const runtime: { current?: ReviewbenchSessionRuntime } = {};
  await render(
    () => (
      <App
        {...project}
        onHostReady={(host) => {
          runtime.current = startReviewbenchSessionRuntime({
            host,
            workspace: project.workspace,
            state: project.state,
            port,
          });
        }}
        onSnapshot={(state) =>
          runtime.current?.updateSnapshot({
            activeWorkspaceId: project.workspace.id,
            workspaces: [state],
          })
        }
      />
    ),
    {
      useMouse: true,
      enableMouseMovement: true,
      exitOnCtrlC: false,
      targetFps: 30,
    },
  );
  runtime.current?.stop();
}
