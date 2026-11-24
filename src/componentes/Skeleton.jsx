// Skeletons universais de carregamento
export function Skeleton({ w = '100%', h = 14, r = 6, style }) {
  return <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />
}

export function SkeletonLinhas({ linhas = 6, colunas = 5 }) {
  return Array.from({ length: linhas }, (_, i) => (
    <tr key={i} className="sk-linha" aria-hidden>
      {Array.from({ length: colunas }, (_, j) => (
        <td key={j}><Skeleton w={j === 0 ? '70%' : `${40 + ((i * 7 + j * 13) % 45)}%`} /></td>
      ))}
    </tr>
  ))
}

export function SkeletonKpis({ n = 4 }) {
  return (
    <div className="grade grade-4" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card kpi"><Skeleton w="45%" h={12} /><Skeleton w="70%" h={26} style={{ marginTop: 12 }} /></div>
      ))}
    </div>
  )
}

export function SkeletonCard({ altura = 220 }) {
  return (
    <div className="card" aria-busy="true">
      <Skeleton w="30%" h={16} />
      <Skeleton h={altura} r={10} style={{ marginTop: 14 }} />
    </div>
  )
}

export function SkeletonForm({ campos = 4 }) {
  return (
    <div className="form" aria-busy="true">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="campo"><Skeleton w="40%" h={11} /><Skeleton h={38} r={9} /></div>
      ))}
    </div>
  )
}
