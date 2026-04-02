'use client'
import { useState, useRef } from 'react'

const STYLES = [
  { id: 'cinematic',  label: 'Cinematic',   emoji: '🎬', desc: 'Filmisch, dramatisch licht' },
  { id: 'anime',      label: 'Anime',        emoji: '✨', desc: 'Japanse animatiestijl' },
  { id: 'watercolor', label: 'Aquarel',      emoji: '🎨', desc: 'Zachte waterverftextuur' },
  { id: 'noir',       label: 'Noir',         emoji: '🌙', desc: 'Donker, scherp contrast' },
  { id: 'sketch',     label: 'Schets',       emoji: '✏️', desc: 'Ruwe potloodtekening' },
  { id: '3d',         label: '3D animatie',  emoji: '🧸', desc: 'Warme 3D-stijl' },
  { id: 'custom',     label: 'Eigen stijl',  emoji: '🖼',  desc: 'Upload een referentie' },
]
const MODELS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2',  sub: 'gratis tier' },
  { id: 'gemini-3-pro-image-preview',     label: 'Nano Banana Pro', sub: 'hogere kwaliteit' },
]

const T = {
  bg:'#f8f8f6',card:'#fff',border:'#e5e3de',borderMd:'#d0cdc7',
  text:'#1a1a1a',textSub:'#4a4845',muted:'#7a7775',faint:'#b0ada8',
  green:'#16a34a',greenBg:'#f0fdf4',greenBd:'#bbf7d0',
  red:'#dc2626',redBg:'#fef2f2',redBd:'#fecaca',
  blue:'#1d4ed8',blueBg:'#eff6ff',blueBd:'#bfdbfe',
  amber:'#92400e',amberBg:'#fffbeb',amberBd:'#fde68a',
  shadow:'0 1px 3px rgba(0,0,0,.06)',
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── API helpers (via Next.js serverless routes — geen CORS) ────────────────
async function apiText(prompt, system, geminiKey) {
  const res = await fetch('/api/gemini-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system, geminiKey, model: 'gemini-1.5-flash' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Fout ${res.status}`)
  return data.text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim()
}

async function apiImage(prompt, geminiKey, modelId, styleBase64, styleMime) {
  const res = await fetch('/api/gemini-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, geminiKey, modelId, styleBase64: styleBase64 || null, styleMime: styleMime || null }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Fout ${res.status}`)
  if (!data.data) throw new Error('Geen afbeeldingdata ontvangen')
  return `data:${data.mimeType || 'image/png'};base64,${data.data}`
}

// ── Wizard bar ─────────────────────────────────────────────────────────────
function WizardBar({ current }) {
  const steps = ['Script', 'Scenes', 'Omschrijving', 'Beelden']
  return (
    <div style={{ display:'flex', alignItems:'flex-start', marginBottom:28 }}>
      {steps.map((s, i) => {
        const n = i + 1, done = current > n, active = current === n
        return (
          <div key={n} style={{ display:'flex', alignItems:'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, flexShrink:0, transition:'all .3s',
                background: done ? T.green : active ? T.text : T.border,
                color: done || active ? '#fff' : T.faint,
              }}>{done ? '✓' : n}</div>
              <span style={{ fontSize:10, whiteSpace:'nowrap', color: done ? T.green : active ? T.text : T.faint, fontWeight: active ? 600 : 400 }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? T.green : T.border, margin:'0 3px', marginBottom:20, transition:'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────
const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20, boxShadow:T.shadow, marginBottom:16 }
const btnPrimary = { padding:'13px 0', background:T.text, border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', letterSpacing:'-.01em', width:'100%' }
const btnSecondary = { padding:'10px 18px', background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.textSub, fontSize:13, fontWeight:500, cursor:'pointer' }
const sectionLabel = { display:'block', fontSize:12, fontWeight:600, color:T.textSub, marginBottom:10 }
const fieldLabel = { fontSize:10, fontWeight:700, color:T.faint, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }
const infoBox = { background:T.blueBg, border:`1px solid ${T.blueBd}`, borderRadius:10, padding:'12px 16px', marginBottom:16 }

export default function StoryboardBuilder() {
  // Config
  const [geminiKey, setGeminiKey]     = useState('')
  const [geminiModel, setGeminiModel] = useState(MODELS[0])
  const [style, setStyle]             = useState(STYLES[0])
  const [styleImage, setStyleImage]   = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  // Wizard
  const [wizardStep, setWizardStep]   = useState(1)
  const [sceneCount, setSceneCount]   = useState(6)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [debug, setDebug]             = useState('')

  // Data
  const [script, setScript]           = useState('')
  const [storyTitle, setStoryTitle]   = useState('')
  const [scenes, setScenes]           = useState([])
  const [images, setImages]           = useState({})
  const [imgErrors, setImgErrors]     = useState({})
  const [imgLoading, setImgLoading]   = useState({})
  const [copied, setCopied]           = useState(null)

  const dropRef = useRef()
  const fileRef = useRef()
  const isCustom = style.id === 'custom'

  // ── File handling ──────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file?.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    setStyleImage({ base64, mime: file.type, preview: URL.createObjectURL(file), name: file.name })
  }

  // ── Step 1→2: split script ─────────────────────────────────────────────
  async function splitScript() {
    if (!geminiKey.trim()) { setError('Vul eerst je Gemini API key in.'); return }
    setLoading(true); setError(''); setDebug('')
    const system = `Split the script into exactly ${sceneCount} scenes. Return ONLY valid JSON, no markdown:
{"title":"Story title","scenes":[{"number":1,"script_line":"exact sentence(s) from script for this scene"}]}
Rules: exactly ${sceneCount} scenes, cover entire script, ONLY JSON.`
    try {
      const text = await apiText(script, system, geminiKey)
      const parsed = JSON.parse(text)
      setStoryTitle(parsed.title || 'Storyboard')
      setScenes((parsed.scenes || []).map(s => ({ number: s.number, script_line: s.script_line || '', visual_description: '', image_prompt: '' })))
      setWizardStep(2)
    } catch (e) { setError('Script splitsen mislukt.'); setDebug(e.message) }
    setLoading(false)
  }

  // ── Step 2→3: visual descriptions ─────────────────────────────────────
  async function generateDescriptions() {
    setLoading(true); setError(''); setDebug('')
    const styleDesc = (isCustom && styleImage) ? 'the visual style shown in the reference image' : `${style.label} style (${style.desc})`
    try {
      const descMap = {}
      const BATCH = 4
      for (let b = 0; b < scenes.length; b += BATCH) {
        const batch = scenes.slice(b, b + BATCH)
        const sceneList = batch.map(s => `Scene ${s.number}: "${s.script_line}"`).join('\n')
        const system = `You are a storyboard artist. For each scene write a visual description and image prompt. Return ONLY valid JSON, no markdown:
{"scenes":[{"number":1,"visual_description":"camera angle, lighting, composition, colors, mood (max 80 words)","image_prompt":"${styleDesc}: [detailed visual scene, camera angle, lighting]. Professional storyboard illustration, 16:9 ratio. (max 60 words)"}]}
Return ONLY JSON.`
        const text = await apiText(`Write visual descriptions:\n\n${sceneList}`, system, geminiKey)
        const parsed = JSON.parse(text)
        ;(parsed.scenes || []).forEach(s => { descMap[s.number] = s })
      }
      setScenes(prev => prev.map(s => ({
        ...s,
        visual_description: descMap[s.number]?.visual_description || '',
        image_prompt: descMap[s.number]?.image_prompt || '',
      })))
      setWizardStep(3)
    } catch (e) { setError('Omschrijvingen genereren mislukt.'); setDebug(e.message) }
    setLoading(false)
  }

  // ── Step 3→5: generate images ──────────────────────────────────────────
  async function generateAllImages() {
    setImages({}); setImgErrors({})
    setWizardStep(5)
    for (let i = 0; i < scenes.length; i++) {
      setImgLoading(prev => ({ ...prev, [i]: true }))
      try {
        const url = await apiImage(scenes[i].image_prompt, geminiKey, geminiModel.id, styleImage?.base64, styleImage?.mime)
        setImages(prev => ({ ...prev, [i]: url }))
      } catch (e) {
        setImages(prev => ({ ...prev, [i]: 'error' }))
        setImgErrors(prev => ({ ...prev, [i]: e.message }))
      }
      setImgLoading(prev => ({ ...prev, [i]: false }))
    }
  }

  async function regenImage(i) {
    setImgLoading(prev => ({ ...prev, [i]: true }))
    setImgErrors(prev => ({ ...prev, [i]: null }))
    try {
      const url = await apiImage(scenes[i].image_prompt, geminiKey, geminiModel.id, styleImage?.base64, styleImage?.mime)
      setImages(prev => ({ ...prev, [i]: url }))
    } catch (e) {
      setImages(prev => ({ ...prev, [i]: 'error' }))
      setImgErrors(prev => ({ ...prev, [i]: e.message }))
    }
    setImgLoading(prev => ({ ...prev, [i]: false }))
  }

  function updateScene(idx, field, val) {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  }
  function addScene(afterIdx) {
    setScenes(prev => {
      const next = [...prev]
      next.splice(afterIdx + 1, 0, { number: 0, script_line: '', visual_description: '', image_prompt: '' })
      return next.map((s, i) => ({ ...s, number: i + 1 }))
    })
  }
  function removeScene(idx) {
    if (scenes.length <= 1) return
    setScenes(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, number: i + 1 })))
  }
  function copyPrompt(i) {
    navigator.clipboard.writeText(scenes[i].image_prompt)
    setCopied(i); setTimeout(() => setCopied(null), 2000)
  }

  // ── Image area ─────────────────────────────────────────────────────────
  function ImageArea({ i }) {
    if (imgLoading[i]) return (
      <div style={{ textAlign:'center', padding:24 }}>
        <div style={{ fontSize:24, marginBottom:8, animation:'bob 1.4s ease-in-out infinite', display:'inline-block' }}>🍌</div>
        <div style={{ fontSize:12, color:T.faint }}>Nano Banana genereert beeld {i + 1}…</div>
      </div>
    )
    if (images[i] && images[i] !== 'error') return (
      <div style={{ position:'relative' }}>
        <img src={images[i]} alt={`Scene ${i + 1}`} style={{ width:'100%', display:'block', maxHeight:320, objectFit:'cover' }} />
        <button onClick={() => regenImage(i)} style={{ position:'absolute', top:10, right:10, background:'rgba(255,255,255,.92)', border:`1px solid ${T.border}`, borderRadius:6, color:T.textSub, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:500 }}>↺ Opnieuw</button>
      </div>
    )
    if (images[i] === 'error') return (
      <div style={{ padding:'12px 14px' }}>
        <div style={{ fontSize:12, color:T.red, fontWeight:600, marginBottom:6 }}>Afbeelding mislukt</div>
        {imgErrors[i] && <div style={{ fontSize:11, color:'#7f1d1d', fontFamily:'monospace', background:'#fee2e2', borderRadius:5, padding:'6px 8px', wordBreak:'break-word', marginBottom:8 }}>{imgErrors[i]}</div>}
        <button onClick={() => regenImage(i)} style={{ ...btnSecondary, fontSize:11, padding:'5px 12px' }}>↺ Opnieuw</button>
      </div>
    )
    return <div style={{ textAlign:'center', padding:20, fontSize:12, color:T.faint }}>Wachten…</div>
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.text, fontFamily:"-apple-system,'Helvetica Neue',Arial,sans-serif", fontSize:14 }}>
      <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} *{box-sizing:border-box;margin:0;padding:0} textarea,input{font-family:inherit} textarea::placeholder,input::placeholder{color:${T.faint}}`}</style>

      {/* Header */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:'0 24px', height:54, display:'flex', alignItems:'center', gap:12, boxShadow:T.shadow, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ width:28, height:28, background:T.text, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🎞</div>
        <span style={{ fontWeight:600, fontSize:15, letterSpacing:'-.01em' }}>Storyboard Builder</span>
        <span style={{ fontSize:11, color:T.faint, fontFamily:'monospace' }}>Gemini Nano Banana</span>
        {wizardStep > 1 && (
          <button onClick={() => { setWizardStep(1); setScenes([]); setImages({}); setError('') }} style={{ ...btnSecondary, marginLeft:'auto', padding:'5px 14px', fontSize:12 }}>← Nieuw script</button>
        )}
      </div>

      <div style={{ maxWidth:800, margin:'0 auto', padding:'28px 20px' }}>

        {/* ══ STAP 1 ══════════════════════════════════════════════════════ */}
        {wizardStep === 1 && (
          <div>
            {/* Script */}
            <div style={card}>
              <label style={sectionLabel}>Script / verhaal</label>
              <textarea value={script} onChange={e => setScript(e.target.value)}
                placeholder="Plak hier je script, synopsis of verhaalbeschrijving…"
                style={{ width:'100%', minHeight:160, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:14, lineHeight:1.7, padding:'12px 14px', resize:'vertical', outline:'none' }}
                onFocus={e => e.target.style.borderColor=T.text} onBlur={e => e.target.style.borderColor=T.border}
              />
            </div>

            {/* Stijl */}
            <div style={card}>
              <label style={sectionLabel}>Beeldstijl</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s)} style={{ background: style.id===s.id ? T.text : T.bg, border:`1px solid ${style.id===s.id ? T.text : T.border}`, borderRadius:8, padding:10, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                    <div style={{ fontSize:16, marginBottom:4 }}>{s.emoji}</div>
                    <div style={{ fontSize:11, fontWeight:600, color: style.id===s.id ? '#fff' : T.text }}>{s.label}</div>
                    <div style={{ fontSize:10, color: style.id===s.id ? '#aaa' : T.faint, marginTop:2 }}>{s.desc}</div>
                  </button>
                ))}
              </div>

              {/* Upload */}
              <div style={{ opacity: isCustom ? 1 : 0.4, pointerEvents: isCustom ? 'auto' : 'none', transition:'opacity .2s' }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.textSub, marginBottom:8 }}>
                  Stijlreferentie {!isCustom && <span style={{ fontWeight:400, color:T.faint }}>— kies Eigen stijl</span>}
                </div>
                <div ref={dropRef}
                  onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('dz-over') }}
                  onDragLeave={() => dropRef.current?.classList.remove('dz-over')}
                  onDrop={e => { e.preventDefault(); dropRef.current?.classList.remove('dz-over'); handleFile(e.dataTransfer.files?.[0]) }}
                  onClick={() => fileRef.current?.click()}
                  style={{ border:`1.5px dashed ${styleImage ? T.green : T.borderMd}`, borderRadius:8, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, background: styleImage ? T.greenBg : T.bg, transition:'all .15s' }}>
                  {styleImage ? (
                    <>
                      <img src={styleImage.preview} alt="" style={{ width:64, height:48, objectFit:'cover', borderRadius:5, border:`1px solid ${T.greenBd}`, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:T.green, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{styleImage.name}</div>
                        <div style={{ fontSize:11, color:'#4ade80', marginTop:2 }}>Nano Banana bootst deze stijl na</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setStyleImage(null) }} style={{ background:T.redBg, border:`1px solid ${T.redBd}`, borderRadius:5, color:T.red, padding:'3px 9px', cursor:'pointer', fontSize:11, fontWeight:500 }}>Verwijder</button>
                    </>
                  ) : (
                    <>
                      <div style={{ width:40, height:40, background:T.border, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🖼</div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:T.textSub }}>Sleep hier of klik om te kiezen</div>
                        <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>PNG, JPG, WEBP</div>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </div>

            {/* Gemini key */}
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:600 }}>🍌 Gemini API key</span>
                  {geminiKey ? <span style={{ fontSize:11, background:T.greenBg, color:T.green, border:`1px solid ${T.greenBd}`, borderRadius:20, padding:'1px 8px', marginLeft:8, fontWeight:500 }}>Ingesteld</span>
                    : <span style={{ fontSize:11, color:T.faint, marginLeft:8 }}>vereist</span>}
                </div>
                <button onClick={() => setShowSettings(!showSettings)} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.textSub, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                  {showSettings ? 'Sluiten' : geminiKey ? 'Wijzigen' : 'Instellen'}
                </button>
              </div>
              {showSettings && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    {MODELS.map(m => (
                      <button key={m.id} onClick={() => setGeminiModel(m)} style={{ flex:1, background: geminiModel.id===m.id ? T.text : T.bg, border:`1px solid ${geminiModel.id===m.id ? T.text : T.border}`, borderRadius:7, padding:'9px 12px', cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                        <div style={{ fontSize:12, fontWeight:600, color: geminiModel.id===m.id ? '#fff' : T.text }}>{m.label}</div>
                        <div style={{ fontSize:10, color: geminiModel.id===m.id ? '#aaa' : T.faint, marginTop:2 }}>{m.sub}</div>
                      </button>
                    ))}
                  </div>
                  <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIza... (Google AI Studio API key)"
                    style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:13, padding:'9px 12px', outline:'none' }}
                    onFocus={e => e.target.style.borderColor=T.text} onBlur={e => e.target.style.borderColor=T.border}
                  />
                  <div style={{ fontSize:11, color:T.faint, marginTop:6 }}>aistudio.google.com/apikey · wordt niet opgeslagen</div>
                </div>
              )}
            </div>

            {error && <div style={{ background:T.redBg, border:`1px solid ${T.redBd}`, borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ fontSize:13, color:T.red, fontWeight:600 }}>{error}</div>
              {debug && <pre style={{ fontSize:11, color:'#7f1d1d', marginTop:6, whiteSpace:'pre-wrap', wordBreak:'break-all', fontFamily:'monospace', background:'#fee2e2', borderRadius:6, padding:'8px 10px' }}>{debug}</pre>}
            </div>}

            <button onClick={splitScript} disabled={!script.trim() || loading} style={{ ...btnPrimary, opacity: !script.trim() || loading ? 0.5 : 1, cursor: !script.trim() || loading ? 'default' : 'pointer' }}>
              {loading ? '⟳  Script analyseren…' : 'Script analyseren →'}
            </button>
          </div>
        )}

        {/* ══ STAP 2 ══════════════════════════════════════════════════════ */}
        {wizardStep === 2 && (
          <div>
            <WizardBar current={2} />
            <div style={infoBox}>
              <strong style={{ color:T.blue, fontSize:13, display:'block', marginBottom:3 }}>✏️ Controleer de scene-verdeling</strong>
              <p style={{ fontSize:12, color:'#1e40af' }}>Pas de tekst per scene aan, voeg scenes toe of verwijder ze.</p>
            </div>

            <div style={card}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:700, letterSpacing:'-.01em' }}>{storyTitle}</div>
                <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>{scenes.length} scenes · {style.emoji} {style.label}</div>
              </div>

              {/* Slider */}
              <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:T.textSub, flexShrink:0 }}>Aantal scenes</label>
                  <input type="range" min={2} max={16} value={sceneCount} onChange={e => setSceneCount(Number(e.target.value))}
                    style={{ flex:1, accentColor:T.text, cursor:'pointer' }} />
                  <span style={{ fontSize:20, fontWeight:700, color:T.text, minWidth:28, textAlign:'right' }}>{sceneCount}</span>
                </div>
                <button onClick={splitScript} disabled={loading} style={{ width:'100%', padding:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.textSub, fontSize:12, fontWeight:500, cursor: loading ? 'default' : 'pointer' }}>
                  {loading ? '⟳  Genereren…' : `↺  Opnieuw met ${sceneCount} scenes`}
                </button>
              </div>

              {scenes.map((sc, i) => (
                <div key={i} style={{ border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ background:T.bg, padding:'8px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:22, height:22, background:T.text, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{sc.number}</div>
                    <span style={{ fontSize:12, fontWeight:600, color:T.textSub }}>Scene {sc.number}</span>
                    <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                      <button onClick={() => addScene(i)} style={{ fontSize:10, padding:'3px 8px', background:T.bg, border:`1px solid ${T.border}`, borderRadius:5, color:T.muted, cursor:'pointer' }}>+ Scene</button>
                      <button onClick={() => removeScene(i)} disabled={scenes.length <= 1} style={{ fontSize:10, padding:'3px 8px', background:T.redBg, border:`1px solid ${T.redBd}`, borderRadius:5, color:T.red, cursor:'pointer' }}>✕</button>
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={fieldLabel}>📄 Tekst uit script</div>
                    <textarea value={sc.script_line} onChange={e => updateScene(i, 'script_line', e.target.value)} rows={3}
                      style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:13, padding:'9px 12px', outline:'none', resize:'vertical', lineHeight:1.65 }}
                      onFocus={e => e.target.style.borderColor=T.text} onBlur={e => e.target.style.borderColor=T.border}
                    />
                  </div>
                </div>
              ))}
              <button onClick={() => addScene(scenes.length - 1)} style={{ width:'100%', padding:9, background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, fontSize:12, fontWeight:500, cursor:'pointer', marginTop:4 }}>+ Scene toevoegen</button>
            </div>

            {error && <div style={{ background:T.redBg, border:`1px solid ${T.redBd}`, borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ fontSize:13, color:T.red, fontWeight:600 }}>{error}</div>
              {debug && <pre style={{ fontSize:11, color:'#7f1d1d', marginTop:6, whiteSpace:'pre-wrap', wordBreak:'break-all', fontFamily:'monospace', background:'#fee2e2', borderRadius:6, padding:'8px 10px' }}>{debug}</pre>}
            </div>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setWizardStep(1)} style={btnSecondary}>← Terug</button>
              <button onClick={generateDescriptions} disabled={loading} style={{ ...btnPrimary, flex:1, opacity: loading ? 0.6 : 1 }}>
                {loading ? '⟳  Beelden omschrijven…' : 'Beelden omschrijven →'}
              </button>
            </div>
          </div>
        )}

        {/* ══ STAP 3 ══════════════════════════════════════════════════════ */}
        {wizardStep === 3 && (
          <div>
            <WizardBar current={3} />
            <div style={infoBox}>
              <strong style={{ color:T.blue, fontSize:13, display:'block', marginBottom:3 }}>✏️ Controleer de visuele omschrijvingen</strong>
              <p style={{ fontSize:12, color:'#1e40af' }}>Pas per scene de omschrijving of beeldprompt aan. Daarna beelden genereren.</p>
            </div>

            {scenes.map((sc, i) => (
              <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', boxShadow:T.shadow, marginBottom:16 }}>
                <div style={{ background:T.bg, padding:'10px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:24, height:24, background:T.text, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{sc.number}</div>
                  <span style={{ fontSize:13, fontWeight:600 }}>Scene {sc.number}</span>
                </div>
                <div style={{ padding:'16px 18px' }}>
                  <div style={{ marginBottom:14 }}>
                    <div style={fieldLabel}>📄 Tekst uit script</div>
                    <div style={{ fontSize:13, color:T.text, lineHeight:1.7, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', fontStyle:'italic' }}>"{sc.script_line}"</div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <div style={fieldLabel}>🎨 Wat je in beeld ziet <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>— aanpasbaar</span></div>
                    <textarea value={sc.visual_description} onChange={e => updateScene(i, 'visual_description', e.target.value)} rows={3}
                      style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:13, padding:'9px 12px', outline:'none', resize:'vertical', lineHeight:1.65 }}
                      onFocus={e => e.target.style.borderColor=T.text} onBlur={e => e.target.style.borderColor=T.border}
                    />
                  </div>
                  <div>
                    <div style={fieldLabel}>🖼 Beeldprompt <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>— aanpasbaar</span></div>
                    <textarea value={sc.image_prompt} onChange={e => updateScene(i, 'image_prompt', e.target.value)} rows={2}
                      style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:13, padding:'9px 12px', outline:'none', resize:'vertical', lineHeight:1.65 }}
                      onFocus={e => e.target.style.borderColor=T.text} onBlur={e => e.target.style.borderColor=T.border}
                    />
                  </div>
                </div>
              </div>
            ))}

            {error && <div style={{ background:T.redBg, border:`1px solid ${T.redBd}`, borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ fontSize:13, color:T.red, fontWeight:600 }}>{error}</div>
            </div>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setWizardStep(2)} style={btnSecondary}>← Terug</button>
              <button onClick={generateAllImages} style={{ ...btnPrimary, flex:1 }}>Beelden genereren →</button>
            </div>
          </div>
        )}

        {/* ══ STAP 5: RESULTAAT ═══════════════════════════════════════════ */}
        {wizardStep === 5 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:600, color:T.faint, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Storyboard</div>
              <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-.02em', marginBottom:6 }}>{storyTitle}</h1>
              <div style={{ fontSize:12, color:T.muted }}>{scenes.length} scenes · {style.emoji} {styleImage ? styleImage.name : style.label} · 🍌 {geminiModel.label}</div>
            </div>

            {scenes.map((sc, i) => (
              <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden', boxShadow:T.shadow, marginBottom:20 }}>
                <div style={{ background:T.bg, padding:'10px 18px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:24, height:24, background:T.text, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{sc.number}</div>
                  <span style={{ fontSize:13, fontWeight:600 }}>Scene {sc.number}</span>
                </div>
                <div style={{ padding:'18px 20px' }}>
                  <div style={{ marginBottom:14 }}>
                    <div style={fieldLabel}>📄 Zin uit script</div>
                    <div style={{ fontSize:13, color:T.text, lineHeight:1.7, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', fontStyle:'italic' }}>"{sc.script_line}"</div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <div style={fieldLabel}>🎨 Wat je in beeld ziet</div>
                    <div style={{ fontSize:13, color:T.textSub, lineHeight:1.7 }}>{sc.visual_description}</div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <div style={fieldLabel}>🖼 Beeld</div>
                    <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden', minHeight:140, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ImageArea i={i} />
                    </div>
                  </div>
                  <details style={{ borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
                    <summary style={{ fontSize:11, color:T.faint, cursor:'pointer', fontWeight:500, userSelect:'none', listStyle:'none' }}>Beeldprompt tonen</summary>
                    <div style={{ marginTop:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ flex:1, fontSize:11, color:T.textSub, lineHeight:1.6, fontFamily:'monospace', wordBreak:'break-word' }}>{sc.image_prompt}</div>
                      <button onClick={() => copyPrompt(i)} style={{ flexShrink:0, background: copied===i ? T.greenBg : T.card, border:`1px solid ${copied===i ? T.greenBd : T.border}`, borderRadius:5, color: copied===i ? T.green : T.muted, padding:'4px 10px', fontSize:11, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
                        {copied === i ? '✓ Gekopieerd' : 'Kopieer'}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            ))}

            <button onClick={() => setWizardStep(3)} style={{ ...btnSecondary, marginTop:8 }}>← Omschrijvingen aanpassen</button>
          </div>
        )}
      </div>
    </div>
  )
}
