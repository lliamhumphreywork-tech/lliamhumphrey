export type AdminAction =
  | 'add_contact'
  | 'update_contact'
  | 'delete_contact'
  | 'update_interaction';

export function logAdminAction(action: AdminAction, detail: Record<string, unknown>): void {
  console.log(JSON.stringify({
    audit: true,
    action,
    ts: new Date().toISOString(),
    ...detail,
  }));
}
