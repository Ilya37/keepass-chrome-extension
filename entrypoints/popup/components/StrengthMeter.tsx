import { calculateStrength } from '@/lib/password-generator';

interface Props {
  password: string;
}

const LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'];

export function StrengthMeter({ password }: Props) {
  if (!password) return null;

  const strength = calculateStrength(password);

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength - 1 ? COLORS[strength - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">{LABELS[strength]}</p>
    </div>
  );
}
