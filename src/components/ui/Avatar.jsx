export default function Avatar({ member, size = 32 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor: member.avatarColour.bg,
        color: member.avatarColour.text,
        fontSize: 11,
      }}
    >
      {member.initials}
    </div>
  )
}
