import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    if (event.request?.data) {
      delete event.request.data;
    }
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
