import { Plane, Car, Moon, Check } from 'lucide-react'

const ICON_MAP = { Plane, Car, Moon }

export default function Step1Template({ templates, selectedId, onSelect }) {
  return (
    <div className="pt-1">
      <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-3">
        Choose a template
      </p>

      <div className="space-y-2">
        {templates.map(tpl => {
          const isSelected = tpl.id === selectedId
          const Icon = ICON_MAP[tpl.icon] || Plane

          return (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl.id)}
              className="w-full flex items-center gap-3 bg-white rounded-card p-3 text-left transition-colors"
              style={{ border: `1.5px solid ${isSelected ? '#3d6494' : '#e0ddd8'}` }}
            >
              {/* Icon tile 42×42 */}
              <div
                className="rounded-input flex items-center justify-center flex-shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  backgroundColor: isSelected ? '#3d6494' : '#f1efe8',
                  color: isSelected ? '#ffffff' : '#6b6b6b',
                }}
              >
                <Icon size={20} />
              </div>

              {/* Name + count */}
              <div className="flex-1 min-w-0">
                <p className="text-14 font-medium text-content-primary">{tpl.name}</p>
                <p className="text-12 text-content-secondary mt-0.5">{tpl.itemCount} items</p>
              </div>

              {/* Check circle */}
              <div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isSelected ? '#3d6494' : 'transparent',
                  border: isSelected ? 'none' : '1.5px solid #e0ddd8',
                }}
              >
                {isSelected && <Check size={13} color="white" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-center text-12 text-content-hint mt-2 leading-snug">
        Edit template names and items anytime in Settings → Pack templates.
      </p>
    </div>
  )
}
