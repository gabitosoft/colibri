import { useEffect, useState } from 'react';

interface Props {
  message: string;
  onDone: () => void;
  duration?: number;
}

export default function Toast({ message, onDone, duration = 2500 }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => setVisible(false), duration - 300);
    const done = setTimeout(onDone, duration);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [duration, onDone]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}
