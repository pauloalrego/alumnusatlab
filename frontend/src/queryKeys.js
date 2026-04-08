// Chaves centralizadas para React Query.
// Normaliza instId: undefined → não faz fetch (enabled: false), null → sem filtro de instituição.

export const keys = {
  reminders:  (instId) => ['reminders',  instId ?? null],
  deadlines:  (instId) => ['deadlines',  instId ?? null],
  tips:       (instId) => ['tips',       instId ?? null],
  tip:        (id)     => ['tip',        id],
  groups:     ()       => ['groups'],
  professors: ()       => ['professors'],
  adminStats: ()       => ['adminStats'],
  adminUsers: ()       => ['adminUsers'],
};
