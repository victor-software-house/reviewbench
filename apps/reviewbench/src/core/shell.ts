export type SidebarView = "files" | "git" | "history" | "notes";

export interface GitHistoryEntry {
  id: string;
  subject: string;
  author: string;
  relativeDate: string;
  refs?: string[] | undefined;
}
