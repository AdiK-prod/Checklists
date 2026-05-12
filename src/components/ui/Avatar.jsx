export default function Avatar({ member, size = 32 }) {
  const bg = member?.avatarColour?.bg ?? '#f1efe8'
  const fg = member?.avatarColour?.text ?? '#6b6b6b'
  const initials = member?.initials ?? '?'
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: 11,
      }}
    >
      {initials}
    </div>
  )
}
