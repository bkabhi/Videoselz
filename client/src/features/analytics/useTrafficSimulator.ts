import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventType, VideoSummary } from '@shared/api';
import { api, ApiRequestError } from '@/lib/api';
import { EVENT_TYPE_LABEL, joinWithAnd } from '@/lib/format';
import { useToasts } from '@/hooks/useToasts';

/** How long the affected row keeps its highlight. Matches the CSS animation. */
const HIGHLIGHT_MS = 1600;

interface UseTrafficSimulator {
  simulate: () => Promise<void>;
  isSimulating: boolean;
  /** Row to pulse after a successful simulation. */
  highlightedVideoId: number | null;
}

/**
 * Builds one plausible storefront session.
 *
 * Firing a single random event type would let add-to-carts outnumber views —
 * data no real storefront could produce, and it would make the conversion-rate
 * column nonsense within a few clicks. A session is a funnel: always a view,
 * sometimes a click, and a cart only ever after a click.
 */
function buildSession(): EventType[] {
  const events: EventType[] = ['view'];
  if (Math.random() < 0.45) {
    events.push('click');
    if (Math.random() < 0.4) events.push('add_to_cart');
  }
  return events;
}

export function useTrafficSimulator(onRecorded: () => void): UseTrafficSimulator {
  const [isSimulating, setIsSimulating] = useState(false);
  const [highlightedVideoId, setHighlightedVideoId] = useState<number | null>(null);
  const { push } = useToasts();

  // Cached so the simulator does not refetch the catalogue on every click.
  const videosRef = useRef<VideoSummary[] | null>(null);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  const simulate = useCallback(async () => {
    setIsSimulating(true);

    try {
      if (!videosRef.current) {
        const response = await api.listVideos();
        videosRef.current = response.data;
      }

      const videos = videosRef.current;
      if (!videos || videos.length === 0) {
        push({
          tone: 'error',
          title: 'No videos to simulate against',
          description: 'Seed the demo catalogue with `npm run db:seed`, then try again.',
        });
        return;
      }

      const video = videos[Math.floor(Math.random() * videos.length)] as VideoSummary;
      const session = buildSession();

      // Sequential, not Promise.all: a click cannot precede its own view, and
      // the timestamps the server assigns are the order these arrive in.
      for (const eventType of session) {
        await api.createEvent({ videoId: video.id, eventType });
      }

      push({
        tone: 'success',
        title: `Recorded ${session.length} ${session.length === 1 ? 'event' : 'events'} on “${video.title}”`,
        description: `${joinWithAnd(session.map((type) => EVENT_TYPE_LABEL[type]))} · ${video.productName}`,
      });

      setHighlightedVideoId(video.id);
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightedVideoId(null), HIGHLIGHT_MS);

      onRecorded();
    } catch (cause) {
      const error =
        cause instanceof ApiRequestError
          ? cause
          : new ApiRequestError(0, 'UNKNOWN_ERROR', 'The simulated event could not be recorded.');

      push({
        tone: 'error',
        title:
          error.code === 'RATE_LIMITED'
            ? 'Slow down a moment'
            : 'Could not record the event',
        description: error.message,
      });
    } finally {
      setIsSimulating(false);
    }
  }, [onRecorded, push]);

  return { simulate, isSimulating, highlightedVideoId };
}
