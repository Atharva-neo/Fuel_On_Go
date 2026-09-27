'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { api, Booking, BookingStatus, getServerNow } from '@/lib/api';

type StatusInfo = {
  label: string;
  className: string;
};

const STATUS_MAP: Record<BookingStatus, StatusInfo> = {
  confirmed: { label: 'Confirmed', className: 'status-chip status-chip--blue' },
  checked_in: { label: 'Checked In', className: 'status-chip status-chip--green' },
  completed: { label: 'Completed', className: 'status-chip status-chip--neutral' },
  cancelled: { label: 'Cancelled', className: 'status-chip status-chip--red' },
  expired: { label: 'Expired', className: 'status-chip status-chip--red' },
};

const STATUS_HINT: Record<BookingStatus, string> = {
  confirmed: 'Arrive 5 minutes before your slot and keep this ticket ready.',
  checked_in: 'You are checked in. Please wait for your token call.',
  completed: 'This booking is completed. You can book a new slot anytime.',
  cancelled: 'This booking was cancelled. You can create a new booking from the map.',
  expired: 'This booking expired due to late arrival. Please book a new slot.',
};

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function formatLocalTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function BookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadBooking() {
      setLoading(true);
      setError('');
      try {
        const data = await api.bookings.get(params.id);
        if (!mounted) return;
        setBooking(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load booking details.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBooking();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!booking?.slotId?.startTime || booking.status !== 'confirmed') {
      setSecondsLeft(0);
      return;
    }
    const target = new Date(booking.slotId.startTime).getTime();

    const tick = () => {
      const now = getServerNow().getTime();
      setSecondsLeft(Math.max(0, Math.floor((target - now) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [booking?.slotId?.startTime, booking?.status]);

  const status = booking ? STATUS_MAP[booking.status] : STATUS_MAP.confirmed;

  const arrivalTime = useMemo(() => {
    if (!booking?.slotId?.startTime) return '';
    const slotStart = new Date(booking.slotId.startTime);
    return formatLocalTime(new Date(slotStart.getTime() - 5 * 60 * 1000));
  }, [booking?.slotId?.startTime]);

  const handleCopy = async () => {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(`${booking.token} (#${booking.tokenNumber})`);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1600);
    } catch {
      setError('Unable to copy token right now. Please copy it manually.');
    }
  };

  const handleShare = async () => {
    if (!booking) return;
    const slotText = `${formatLocalTime(booking.slotId.startTime)} - ${formatLocalTime(booking.slotId.endTime)}`;
    const message = `Fuel on Go Booking\nPump: ${booking.pumpId.name}\nToken: #${booking.tokenNumber} (${booking.token})\nSlot: ${slotText}\nArrive By: ${arrivalTime}`;

    try {
      const nav = navigator as Navigator & {
        share?: (data?: ShareData) => Promise<void>;
      };
      if (typeof nav.share === 'function') {
        await nav.share({
          title: `Booking #${booking.tokenNumber}`,
          text: message,
        });
      } else if (nav.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
      } else {
        throw new Error('Sharing not supported');
      }
      setShareSuccess(true);
      window.setTimeout(() => setShareSuccess(false), 1800);
    } catch {
      setError('Unable to share booking right now. Please try again.');
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    const confirmed = window.confirm('Cancel this booking?');
    if (!confirmed) return;

    setCancelling(true);
    try {
      await api.bookings.cancel(booking._id);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel booking.');
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main className="screen-center">
        <div className="spinner" />
        <p>Fetching booking...</p>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="screen-center">
        <p className="error-text">{error || 'Booking not found.'}</p>
        <Link href="/" className="primary-btn">
          Back to Map
        </Link>
      </main>
    );
  }

  return (
    <main className="ticket-screen">
      <header className="flow-topbar">
        <Link href="/" className="ghost-btn">
          Map
        </Link>
        <div className="flow-topbar__center">
          <p className="flow-title">Booking Ticket</p>
          <p className="flow-sub">{booking.pumpId.name}</p>
        </div>
        <span className={status.className}>{status.label}</span>
      </header>

      <section className="ticket-card">
        <div className="ticket-card__top">
          <p className="ticket-label">TOKEN</p>
          <div className="token-line">
            <p className="token-number">#{booking.tokenNumber}</p>
            <button className="ghost-btn" onClick={handleCopy}>
              {copySuccess ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="token-ref">{booking.token}</p>
        </div>

        <div className="ticket-card__meta">
          <div>
            <p className="section-caption">Slot Time</p>
            <p className="section-label">
              {formatLocalTime(booking.slotId.startTime)} - {formatLocalTime(booking.slotId.endTime)}
            </p>
          </div>
          <div>
            <p className="section-caption">Arrive By</p>
            <p className="section-label">{arrivalTime}</p>
          </div>
          <div>
            <p className="section-caption">Vehicle</p>
            <p className="section-label">{booking.vehicleNumber}</p>
          </div>
          <div>
            <p className="section-caption">Type</p>
            <p className="section-label">{booking.vehicleType}</p>
          </div>
        </div>

        {booking.qrCode ? (
          <div className="qr-panel">
            <Image
              src={booking.qrCode}
              alt={`QR for ${booking.token}`}
              width={150}
              height={150}
              unoptimized
            />
          </div>
        ) : null}

        {booking.status === 'confirmed' && (
          <div className="countdown-panel">
            <p className="section-caption">Time Left To Slot</p>
            <p className="countdown-value">{formatCountdown(secondsLeft)}</p>
          </div>
        )}
      </section>

      <section className="ticket-actions">
        <button className="ghost-btn wide" onClick={handleShare}>
          {shareSuccess ? 'Shared' : 'Share Ticket'}
        </button>
        <Link href="/" className="ghost-btn wide">
          Back to Map
        </Link>
        {booking.status === 'confirmed' && (
          <button className="danger-btn wide" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
          </button>
        )}
      </section>

      <p className="section-caption">{STATUS_HINT[booking.status]}</p>
      {error && <p className="error-text">{error}</p>}
    </main>
  );
}
