// Submission state machine for the rating sheet. Rules:
//  * "success" is only reported after the backend confirmed the save;
//  * on any failure the draft (stars, tags, text) is kept so the customer can retry;
//  * a second tap while a request is in flight does nothing (no duplicate requests);
//  * retries are safe because the backend allows one rating per booking and treats an
//    identical resubmission as a no-op.
import { canSubmitRating } from './ratingModel.ts';

export interface RatingDraft {
  rating: number;
  review: string;
  tags: string[];
}

export type SubmitStatus = 'idle' | 'submitting' | 'error' | 'success';

export interface SubmitState {
  status: SubmitStatus;
  draft: RatingDraft;
  error: string | null;
  result: unknown;
}

export function describeSubmitError(err: any): string {
  const code = err?.response?.data?.code;
  const msg = err?.response?.data?.error;
  if (code === 'NOT_COMPLETED') return 'You can rate this pump once your visit is completed.';
  if (code === 'OWN_PUMP') return 'You cannot rate a pump you own.';
  if (code === 'NOT_YOUR_BOOKING' || code === 'BOOKING_NOT_FOUND') return 'This booking cannot be rated from your account.';
  if (code === 'EDIT_WINDOW_CLOSED') return 'This rating can no longer be changed.';
  if (code === 'RATINGS_NOT_MIGRATED') return 'Ratings are not available yet. Please try again later.';
  if (msg && err?.response?.status && err.response.status < 500) return msg;
  if (!err?.response) return "Couldn't reach the server. Check your connection and try again. Your rating is saved on this screen.";
  return 'Something went wrong. Please try again.';
}

export function createRatingSubmitter(opts: {
  submit: (draft: RatingDraft) => Promise<unknown>;
  initial?: Partial<RatingDraft>;
  onChange?: (s: SubmitState) => void;
}) {
  let state: SubmitState = {
    status: 'idle',
    draft: { rating: 0, review: '', tags: [], ...opts.initial },
    error: null,
    result: null,
  };
  const emit = (patch: Partial<SubmitState>) => {
    state = { ...state, ...patch };
    opts.onChange?.(state);
  };

  return {
    getState: () => state,
    setDraft(patch: Partial<RatingDraft>) {
      if (state.status === 'submitting') return; // frozen while the request is in flight
      emit({ draft: { ...state.draft, ...patch }, status: state.status === 'error' ? 'idle' : state.status, error: null });
    },
    async send() {
      if (state.status === 'submitting' || state.status === 'success') return state; // double-tap guard
      if (!canSubmitRating(state.draft)) {
        emit({ status: 'error', error: 'Choose a star rating first.' });
        return state;
      }
      emit({ status: 'submitting', error: null });
      try {
        const result = await opts.submit(state.draft);
        emit({ status: 'success', result }); // only now is the UI allowed to say "thank you"
      } catch (err) {
        emit({ status: 'error', error: describeSubmitError(err) }); // draft untouched
      }
      return state;
    },
  };
}
