export interface SessionTargetInput {
  sessionId?: string | undefined;
  sessionPath?: string | undefined;
  repoRoot?: string | undefined;
}

export interface SessionTerminalLocation {
  source: string;
  tty?: string | undefined;
  windowId?: string | undefined;
  tabId?: string | undefined;
  paneId?: string | undefined;
  terminalId?: string | undefined;
  sessionId?: string | undefined;
}

export interface SessionTerminalMetadata {
  program?: string | undefined;
  locations: SessionTerminalLocation[];
}

/** Wrap one app-owned registration payload in the broker's shared session envelope. */
export interface SessionRegistration<Info = unknown> {
  registrationVersion: number;
  sessionId: string;
  pid: number;
  cwd: string;
  repoRoot?: string | undefined;
  launchedAt: string;
  terminal?: SessionTerminalMetadata | undefined;
  info: Info;
}

/** Wrap one app-owned live state payload in the broker's shared snapshot envelope. */
export interface SessionSnapshot<State = unknown> {
  updatedAt: string;
  state: State;
}

export type SessionClientMessage<Info = unknown, State = unknown, Result = unknown> =
  | {
      type: "register";
      registration: SessionRegistration<Info>;
      snapshot: SessionSnapshot<State>;
    }
  | {
      type: "snapshot";
      sessionId: string;
      snapshot: SessionSnapshot<State>;
    }
  | {
      type: "heartbeat";
      sessionId: string;
    }
  | {
      type: "command-result";
      requestId: string;
      ok: true;
      result: Result;
    }
  | {
      type: "command-result";
      requestId: string;
      ok: false;
      error: string;
    };

export type SessionServerMessage<CommandName extends string = string, Input = unknown> = {
  type: "command";
  requestId: string;
  command: CommandName;
  input: Input;
};
