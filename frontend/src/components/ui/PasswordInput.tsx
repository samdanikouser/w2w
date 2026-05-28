import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

/**
 * Light-themed password input (uses the global `.fc` styling) with a
 * show/hide eye toggle. For use inside `.fg` form groups.
 */
export default function PasswordInput({ value, onChange, placeholder, autoComplete }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="fc"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          top: '50%',
          right: 8,
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text3)',
          display: 'flex',
          alignItems: 'center',
          padding: 4,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-w2w)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text3)')}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
