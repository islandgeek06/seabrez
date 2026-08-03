import { useEffect, useState } from 'react'

// Live weather with zero setup: IP-based location (geojs.io, no key) →
// Open-Meteo current conditions (no key). Fails quietly if offline.
interface Weather {
  tempF: number
  label: string
  emoji: string
  city: string
}

// WMO weather-code → emoji + text.
function describe(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Clear' }
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' }
  if (code <= 48) return { emoji: '🌫️', label: 'Fog' }
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle' }
  if (code <= 67) return { emoji: '🌧️', label: 'Rain' }
  if (code <= 77) return { emoji: '❄️', label: 'Snow' }
  if (code <= 82) return { emoji: '🌦️', label: 'Showers' }
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers' }
  return { emoji: '⛈️', label: 'Thunderstorm' }
}

export function WeatherWidget() {
  const [w, setW] = useState<Weather | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const geo = await fetch('https://get.geojs.io/v1/ip/geo.json').then((r) => r.json())
        const lat = geo.latitude
        const lon = geo.longitude
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`,
        ).then((r) => r.json())
        const code = res.current?.weather_code ?? 0
        const d = describe(code)
        if (!cancelled)
          setW({
            tempF: Math.round(res.current?.temperature_2m ?? 0),
            label: d.label,
            emoji: d.emoji,
            city: geo.city || geo.region || '',
          })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return null
  if (!w)
    return (
      <div className="weather weather-loading glass">
        <span className="weather-emoji">🌡️</span>
        <span className="weather-sub">Loading weather…</span>
      </div>
    )

  return (
    <div className="weather glass">
      <span className="weather-emoji">{w.emoji}</span>
      <div className="weather-info">
        <span className="weather-temp">{w.tempF}°</span>
        <span className="weather-sub">
          {w.label}
          {w.city ? ` · ${w.city}` : ''}
        </span>
      </div>
    </div>
  )
}
