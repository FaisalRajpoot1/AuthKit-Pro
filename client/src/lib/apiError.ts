import { AxiosError } from 'axios';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

/** Extracts a user-facing message from an unknown error (often an AxiosError). */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.error?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
