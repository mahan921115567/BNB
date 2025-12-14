
export interface AppNotification {
  id: string;
  userId: string | 'all'; // 'all' for admin broadcasts
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}
