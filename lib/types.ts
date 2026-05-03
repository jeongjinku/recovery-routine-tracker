export type LogEntry = {
  date: string;
  wakeTime: string;
  workStart: string;
  workEnd: string;
  sleep: number;
  healthyFood: boolean;
  moveEveryTwoHours: boolean;
  stretching: boolean;
  walk15: boolean;
  cardio10: boolean;
  familyDinner: boolean;
  kidsBedtime: boolean;
  phoneFreeDinner: boolean;
  lateTextNotice: boolean;
  taekwondoRide: boolean;
  monthlyFridayLunch: boolean;
  lateSleepReason: boolean;
  weekendComputerLimit: boolean;
  note: string;
  meals?: boolean;
  breaks?: boolean;
  exercise?: boolean;
};

export type SupabaseLogRow = {
  log_date: string;
  data: LogEntry;
};

export type ReminderState = {
  enabled: boolean;
  time: string;
  lastNotified: string;
};
