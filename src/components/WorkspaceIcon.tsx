import { useEffect, useRef, useState } from 'react'
import {
  User,
  Briefcase,
  House,
  Code2,
  Rocket,
  BookOpen,
  Palette,
  FlaskConical,
  Globe,
  Layers,
  GraduationCap,
  Music,
  Heart,
  ShoppingBag,
  Camera,
  Dumbbell,
  Landmark,
  Star,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// A curated, premium line-icon set for workspaces — replaces the playful
// emoji. Icons render monochrome in the workspace's accent color, matching the
// rest of the app's line-icon aesthetic.
export const WS_ICONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'user', Icon: User, label: 'Personal' },
  { key: 'work', Icon: Briefcase, label: 'Work' },
  { key: 'home', Icon: House, label: 'Home' },
  { key: 'code', Icon: Code2, label: 'Code' },
  { key: 'rocket', Icon: Rocket, label: 'Projects' },
  { key: 'bookOpen', Icon: BookOpen, label: 'Reading' },
  { key: 'palette', Icon: Palette, label: 'Design' },
  { key: 'flask', Icon: FlaskConical, label: 'Research' },
  { key: 'globe', Icon: Globe, label: 'Web' },
  { key: 'layers', Icon: Layers, label: 'General' },
  { key: 'study', Icon: GraduationCap, label: 'Study' },
  { key: 'music', Icon: Music, label: 'Music' },
  { key: 'heart', Icon: Heart, label: 'Favorites' },
  { key: 'shopping', Icon: ShoppingBag, label: 'Shopping' },
  { key: 'media', Icon: Camera, label: 'Media' },
  { key: 'fitness', Icon: Dumbbell, label: 'Fitness' },
  { key: 'finance', Icon: Landmark, label: 'Finance' },
  { key: 'star', Icon: Star, label: 'Starred' },
  { key: 'ai', Icon: Sparkles, label: 'AI' },
]

const BY_KEY = new Map(WS_ICONS.map((i) => [i.key, i.Icon]))

// Back-compat: quietly upgrade legacy emoji icons (from earlier versions) to
// the matching premium line icon, so existing workspaces look premium too.
const EMOJI_ALIAS: Record<string, string> = {
  '🏠': 'home',
  '💼': 'work',
  '🗂️': 'layers',
  '🗂': 'layers',
  '📁': 'layers',
  '💻': 'code',
  '🚀': 'rocket',
  '📚': 'bookOpen',
  '🎨': 'palette',
  '🔬': 'flask',
  '🌐': 'globe',
  '🎓': 'study',
  '🎵': 'music',
  '❤️': 'heart',
  '🛍️': 'shopping',
  '📷': 'media',
  '🏋️': 'fitness',
  '🏛️': 'finance',
  '⭐': 'star',
  '✨': 'ai',
}

export function resolveWsIcon(icon: string): LucideIcon | null {
  if (!icon) return BY_KEY.get('layers') ?? null
  if (BY_KEY.has(icon)) return BY_KEY.get(icon) ?? null
  const alias = EMOJI_ALIAS[icon]
  if (alias) return BY_KEY.get(alias) ?? null
  return null
}

export function WsIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const Icon = resolveWsIcon(icon)
  if (Icon) return <Icon size={size} strokeWidth={1.75} />
  // Unknown custom value — fall back to rendering it verbatim.
  return <span className="ws-emoji">{icon}</span>
}

// A small popover picker for choosing a workspace icon from the premium set.
export function WsIconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="ws-iconpick" ref={ref}>
      <button
        type="button"
        className="ws-iconpick-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose workspace icon"
        title="Choose icon"
      >
        <WsIcon icon={value} size={18} />
      </button>
      {open && (
        <div className="ws-iconpick-pop glass-strong" role="listbox">
          {WS_ICONS.map(({ key, Icon, label }) => (
            <button
              type="button"
              key={key}
              className={`ws-iconpick-opt ${value === key ? 'active' : ''}`}
              title={label}
              aria-label={label}
              onClick={() => {
                onChange(key)
                setOpen(false)
              }}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
