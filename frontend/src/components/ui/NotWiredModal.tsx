import { X, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  module: string;
  apiPath?: string;
  description?: string;
}

/**
 * Friendly modal shown when a user clicks an action whose backend endpoint
 * is not yet wired. Replaces silent buttons with an honest explanation.
 */
export default function NotWiredModal({ open, onClose, title, module, apiPath, description }: Props) {
  if (!open) return null;
  return (
    <div className="modal-ov open" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <span className="mt">{title}</span>
          <button onClick={onClose} className="mc"><X size={15} /></button>
        </div>
        <div className="mb">
          <div className="alert alert-blue">
            <Info size={14} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>The {module} API isn't wired yet</div>
              <div style={{ fontSize: 11, color: 'var(--color-text2)', lineHeight: 1.5 }}>
                {description ||
                  `This screen will become fully interactive once the ${module.toLowerCase()} backend endpoint is exposed.`}
                {apiPath && (
                  <>
                    {' '}
                    Wire <code style={{ background: 'var(--color-surface3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{apiPath}</code> and this action will create real records.
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text2)', marginTop: 12 }}>
            In the meantime, the layout reflects the production design — every column, filter, badge, and action is in place and ready for live data.
          </div>
        </div>
        <div className="mf">
          <button onClick={onClose} className="btn btn-primary">Got it</button>
        </div>
      </div>
    </div>
  );
}
