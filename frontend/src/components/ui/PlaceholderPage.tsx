import { Construction } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-w2w-light)' }}
      >
        <Construction size={28} className="text-w2w" />
      </div>
      <h2 className="text-lg font-bold text-text mb-1">{title}</h2>
      <p className="text-xs text-text3 max-w-md">
        {description || 'This module is under development. Full CRUD functionality with forms and data management will be available soon.'}
      </p>
    </div>
  );
}
