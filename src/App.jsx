import { useEffect, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Edit3, LayoutDashboard, LockKeyhole, Plus, Scissors, Settings2, Trash2, Users, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'

const initialServices = [
  { id: 1, name: 'Corte Natural', price: 120, duration: 30, active: true },
  { id: 2, name: 'Corte y Barba', price: 180, duration: 45, active: true },
  { id: 3, name: 'Corte, Barba y Ceja', price: 200, duration: 60, active: true },
  { id: 4, name: 'Arreglo de Barba', price: 90, duration: 30, active: true },
]
const initialBarbers = [
  { id: 1, name: 'Jackie Ramos', specialty: 'Estilista', initials: 'JR', color: 'bg-amber-700', isApprentice: false },
]
const initialAppointments = [
  { id: 1, client: 'Carlos Mendoza', service: 'Corte y Barba', barber: 'Mateo Cruz', date: '2026-09-29', time: '10:30', status: 'confirmada', price: 180 },
  { id: 2, client: 'Jorge Salas', service: 'Corte Natural', barber: 'Damián Reyes', date: '2026-09-29', time: '12:00', status: 'pendiente', price: 120 },
  { id: 3, client: 'Andrés Gil', service: 'Corte, Barba y Ceja', barber: 'Santiago León', date: '2026-09-28', time: '17:00', status: 'completada', price: 200 },
  { id: 4, client: 'Raúl Vega', service: 'Arreglo de Barba', barber: 'Mateo Cruz', date: '2026-09-30', time: '18:30', status: 'cancelada', price: 90 },
]
const times = ['10:30', '11:00', '11:30', '12:00', '1:00', '2:00', '5:00', '5:30', '6:00', '6:30', '7:00', '7:30']
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const dateLabel = (date) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const isSunday = (date) => new Date(`${date}T12:00:00`).getDay() === 0
const isSaturday = (date) => new Date(`${date}T12:00:00`).getDay() === 6
const walkInLabel = 'Por orden de llegada'
// Los horarios de la lista van en orden cronológico (10:30 a 19:30); las horas 1-7 son de la tarde.
const toMinutes = (time) => { const [hourPart, minutePart] = time.split(':'); let hour = Number(hourPart); const minute = Number(minutePart); if (hour >= 1 && hour <= 7) hour += 12; return hour * 60 + minute }
// Servicios de más de 30 min ocupan también el turno siguiente, para darle tiempo al barbero.
const nextTime = (time) => { const index = times.indexOf(time); return index >= 0 && index < times.length - 1 ? times[index + 1] : null }
const requiredSlots = (time, duration) => duration > 30 ? [time, nextTime(time)].filter(Boolean) : [time]
const dateValue = (date) => date.toLocaleDateString('en-CA')
const todayValue = dateValue(new Date())
const bookingDates = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + index); return dateValue(date) })
const toAppointment = (row) => ({ id: row.id, client: row.client_name, phone: row.phone, service: row.service, barber: row.barber, date: row.appointment_date, time: row.appointment_time, status: row.status, price: Number(row.price) })
const toService = (row) => ({ id: row.id, name: row.name, price: Number(row.price), duration: row.duration, active: row.active })
const toBarber = (row) => ({ id: row.id, name: row.name, specialty: row.specialty, initials: row.initials, color: row.color, isApprentice: row.is_apprentice ?? false })

function Brand() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center border border-[#c9a84c] text-[#c9a84c]"><Scissors size={20} /></div><p className="font-serif text-2xl italic leading-none text-[#f5f5f5] drop-shadow-[0_1px_10px_rgba(201,168,76,0.25)]">BarberShop</p></div>
}
function StepTitle({ eyebrow, title, description }) {
  return <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#c9a84c]">{eyebrow}</p><h2 className="mt-2 font-serif text-3xl">{title}</h2><p className="mt-2 text-sm text-[#a0a0a0]">{description}</p></div>
}
function PublicBooking({ services, barbers, step, setStep, booking, setBooking, success, setSuccess, saveAppointment, occupiedTimes }) {
  const selectedService = services.find((item) => item.id === booking.service)
  const needsBarberChoice = barbers.length > 1
  const selectedBarber = needsBarberChoice ? barbers.find((item) => item.id === booking.barber) : barbers[0]
  const steps = ['Servicio', 'Fecha y hora', 'Contacto', 'Confirmar']
  const occupied = occupiedTimes
  const isWalkInDay = booking.date && isSaturday(booking.date)
  const isTodaySelected = booking.date === todayValue
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const pastTimes = isTodaySelected ? times.filter((time) => toMinutes(time) <= nowMinutes) : []
  const serviceDuration = selectedService?.duration || 30
  const isTimeDisabled = (time) => pastTimes.includes(time) || requiredSlots(time, serviceDuration).some((slot) => occupied.includes(slot))
  const availableTimes = times.filter((time) => !isTimeDisabled(time))
  const noTimesLeftToday = isTodaySelected && !isWalkInDay && availableTimes.length === 0
  const canContinue = step === 1 ? booking.service && (!needsBarberChoice || booking.barber) : step === 2 ? booking.date && !isSunday(booking.date) && (isWalkInDay || booking.time) : step === 3 ? booking.name.trim() && /^\d{10}$/.test(booking.phone) : true
  const confirm = async () => {
    const appointmentBarber = selectedBarber || barbers[0]
    const appointment = { id: Date.now(), client: booking.name, phone: booking.phone, service: selectedService.name, barber: appointmentBarber?.name || '', date: booking.date, time: isWalkInDay ? walkInLabel : booking.time, status: 'confirmada', price: selectedService.price }
    const savedAppointment = await saveAppointment(appointment)
    if (savedAppointment) setSuccess(savedAppointment)
  }
  return <div className="mx-auto max-w-6xl px-5 pb-20"><header className="flex items-center border-b border-[#c9a84c]/20 py-6"><Brand /></header>
    <section className="py-10"><p className="mb-2 text-center text-xs font-bold uppercase tracking-[.2em] text-[#c9a84c]">Agenda en línea</p><h1 className="text-center font-serif text-4xl sm:text-5xl">Tu próximo corte empieza aquí.</h1><div className="mx-auto mt-10 flex max-w-3xl items-start justify-between">{steps.map((label, index) => <button key={label} onClick={() => index + 1 < step && setStep(index + 1)} className="relative flex flex-1 flex-col items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-full border text-xs ${step >= index + 1 ? 'border-[#c9a84c] bg-[#c9a84c] text-[#0f0e0c]' : 'border-[#c9a84c]/25 text-[#a0a0a0]'}`}>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{index < 4 && <i className={`absolute left-[60%] top-4 h-px w-[80%] ${step > index + 1 ? 'bg-[#c9a84c]' : 'bg-[#c9a84c]/20'}`} />}<span className="hidden text-[10px] uppercase tracking-wider text-[#a0a0a0] sm:block">{label}</span></button>)}</div></section>
    <section className="mx-auto max-w-4xl rounded-lg border border-[#c9a84c]/20 bg-[#1a1916] p-6 shadow-2xl sm:p-10">
      {step === 1 && <><StepTitle eyebrow="Paso 01" title="Elige tu servicio" description="Cada detalle cuenta. Selecciona tu experiencia." /><div className="grid gap-3 sm:grid-cols-2">{services.filter((item) => item.active).map((item) => <button key={item.id} onClick={() => setBooking({ ...booking, service: item.id })} className={`service-card text-left ${booking.service === item.id ? 'selected' : ''}`}><div><h3 className="font-serif text-xl">{item.name}</h3><p className="mt-2 flex items-center gap-1 text-xs text-[#a0a0a0]"><Clock3 size={13} /> {item.duration} min.</p></div><strong className="text-lg text-[#c9a84c]">{currency.format(item.price)}</strong></button>)}</div>{needsBarberChoice && <><p className="mb-3 mt-7 text-sm font-semibold">Elige tu barbero</p><div className="grid gap-3 sm:grid-cols-2">{barbers.map((item) => <button key={item.id} onClick={() => setBooking({ ...booking, barber: item.id })} className={`service-card text-left ${booking.barber === item.id ? 'selected' : ''}`}><div className="flex items-center gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.color} font-serif text-sm`}>{item.initials}</div><div><h3 className="font-serif text-lg">{item.name}</h3><p className="text-xs text-[#a0a0a0]">{item.specialty}</p></div></div>{item.isApprentice && <span className="mt-3 inline-block rounded-full border border-[#c9a84c]/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c9a84c]">Aprendiz</span>}</button>)}</div></>}</>}
      {step === 2 && <><StepTitle eyebrow="Paso 02" title="Elige fecha y hora" description="Disponibilidad actualizada al momento. Los domingos permanecemos cerrados y los sábados se atiende por orden de llegada." /><p className="mb-3 text-sm font-semibold">Fecha</p><div className="hide-scrollbar mb-7 flex gap-2 overflow-x-auto pb-1">{bookingDates.map((date) => { const closed = isSunday(date); const walkIn = isSaturday(date); const formatted = new Date(`${date}T12:00:00`); return <button disabled={closed} key={date} onClick={() => setBooking({ ...booking, date, time: null })} className={`min-w-20 border px-3 py-3 text-center text-xs ${booking.date === date ? 'border-[#c9a84c] bg-[#c9a84c] font-bold text-[#0f0e0c]' : closed ? 'cursor-not-allowed border-[#302f2b] bg-[#262522] text-[#666] line-through' : 'border-[#c9a84c]/20 text-[#f5f5f5] hover:border-[#c9a84c]'}`}><span className="block text-[10px] uppercase">{formatted.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</span><strong className="mt-1 block text-lg">{formatted.getDate()}</strong>{closed && <span className="mt-1 block text-[9px] no-underline">Cerrado</span>}{!closed && walkIn && <span className="mt-1 block text-[9px] text-[#c9a84c] no-underline">Sin cita</span>}</button> })}</div><p className="mb-3 text-sm font-semibold">Horarios disponibles</p>{isWalkInDay ? <div className="rounded border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-4 text-sm text-[#c9a84c]">Los sábados no es necesario reservar hora: te atendemos por orden de llegada. Preséntate directamente en la barbería.</div> : <><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{times.map((time) => { const disabled = isTimeDisabled(time); return <button disabled={disabled} key={time} onClick={() => setBooking({ ...booking, time })} className={`time-slot ${booking.time === time ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>{time}</button> })}</div>{serviceDuration > 30 && <p className="mt-3 text-xs text-[#a0a0a0]">Este servicio dura más de 30 min, por lo que también ocupa el turno siguiente.</p>}{noTimesLeftToday && <p className="mt-3 text-xs text-[#a0a0a0]">Ya no quedan horarios disponibles por hoy. Elige otra fecha.</p>}</>}</>}
      {step === 3 && <><StepTitle eyebrow="Paso 03" title="Tus datos" description="Usaremos esta información solo para tu reserva." /><div className="grid gap-5"><label className="form-label">Nombre completo<input value={booking.name} onChange={(event) => setBooking({ ...booking, name: event.target.value })} placeholder="Tu nombre" className="dark-input" /></label><label className="form-label">Teléfono (10 dígitos)<input value={booking.phone} onChange={(event) => setBooking({ ...booking, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="55 0000 0000" inputMode="numeric" className="dark-input" />{booking.phone && booking.phone.length < 10 && <span className="text-xs text-red-400">Ingresa exactamente 10 dígitos.</span>}</label></div></>}
      {step === 4 && <><StepTitle eyebrow="Paso 04" title="Revisa tu cita" description="Todo listo para que disfrutes la experiencia." /><div className="divide-y divide-[#c9a84c]/15 rounded border border-[#c9a84c]/20 bg-[#0f0e0c]/40 px-5">{[['Servicio', selectedService?.name], ['Barbero', selectedBarber ? `${selectedBarber.name}${selectedBarber.isApprentice ? ' (Aprendiz)' : ''}` : ''], ['Fecha', dateLabel(booking.date)], ['Hora', isWalkInDay ? walkInLabel : booking.time], ['Cliente', booking.name], ['Total', currency.format(selectedService?.price || 0)]].map(([label, value]) => <div key={label} className="flex justify-between gap-6 py-4 text-sm"><span className="text-[#a0a0a0]">{label}</span><strong className={label === 'Total' ? 'text-[#c9a84c]' : ''}>{value}</strong></div>)}</div></>}
      <div className="mt-10 flex items-center justify-between border-t border-[#c9a84c]/15 pt-6"><button onClick={() => setStep(Math.max(1, step - 1))} className={`flex items-center gap-1 text-sm text-[#a0a0a0] ${step === 1 ? 'invisible' : ''}`}><ChevronLeft size={16} /> Volver</button>{step === 4 ? <button onClick={confirm} className="gold-button">Confirmar cita <Check size={17} /></button> : <button disabled={!canContinue} onClick={() => canContinue && setStep(step + 1)} className="gold-button disabled:cursor-not-allowed disabled:opacity-30">Continuar <ChevronRight size={17} /></button>}</div>
    </section>{success && <SuccessModal booking={success} onClose={() => { setSuccess(false); setStep(1); setBooking({ service: null, barber: null, date: bookingDates.find((date) => !isSunday(date)), time: null, name: '', phone: '' }) }} />}</div>
}
function SectionHeader({ title, text, action }) { return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#c9a84c]">Administración</p><h1 className="mt-2 font-serif text-3xl">{title}</h1><p className="mt-1 text-sm text-[#a0a0a0]">{text}</p></div>{action}</div> }
function StatusBadge({ status }) { return <span className={`status ${status}`}>{status}</span> }
function AdminPanel({ services, setServices, barbers, setBarbers, appointments, setAppointments, updateAppointment, saveCatalogItem, deleteCatalogItem }) {
  const [tab, setTab] = useState('Dashboard'); const [statusFilter, setStatusFilter] = useState('todas'); const [modal, setModal] = useState(null); const [schedule, setSchedule] = useState({ start: '10:00', end: '20:00', days: [true, true, true, true, true, true, false] })
  const tabs = [['Dashboard', LayoutDashboard], ['Citas', CalendarDays], ['Servicios', Scissors], ['Barberos', Users], ['Horarios', Settings2]]
  const save = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const type = modal.type; const item = type === 'service' ? { id: modal.item?.id, name: form.get('name'), price: Number(form.get('price')), duration: Number(form.get('duration')), active: modal.item?.active ?? true } : { id: modal.item?.id, name: form.get('name'), specialty: form.get('specialty'), initials: form.get('name').split(' ').map((part) => part[0]).join('').slice(0, 2), color: modal.item?.color || 'bg-amber-700', isApprentice: form.get('isApprentice') === 'on' }; const savedItem = await saveCatalogItem(type, item); if (!savedItem) return; if (type === 'service') setServices((items) => modal.item ? items.map((current) => current.id === savedItem.id ? savedItem : current) : [...items, savedItem]); else setBarbers((items) => modal.item ? items.map((current) => current.id === savedItem.id ? savedItem : current) : [...items, savedItem]); setModal(null) }
  const remove = async () => { if (modal.type === 'appointment') await updateAppointment(modal.item.id, 'cancelada'); if (modal.type === 'delete-service') { if (await deleteCatalogItem('service', modal.item.id)) setServices((items) => items.filter((item) => item.id !== modal.item.id)) } if (modal.type === 'delete-barber') { if (await deleteCatalogItem('barber', modal.item.id)) setBarbers((items) => items.filter((item) => item.id !== modal.item.id)) } setModal(null) }
  return <div className="min-h-screen"><header className="border-b border-[#c9a84c]/20 bg-[#1a1916]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-8"><Brand /><nav aria-label="Secciones administrativas" className="grid w-full grid-cols-2 gap-1 sm:flex sm:flex-1 sm:w-auto sm:gap-1 sm:overflow-x-auto">{tabs.map(([name, Icon]) => <button key={name} onClick={() => setTab(name)} className={`admin-tab ${tab === name ? 'active' : ''}`}><Icon size={16} /> {name}</button>)}</nav></div></header><div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-9">
    {tab === 'Dashboard' && <Dashboard appointments={appointments} />}
    {tab === 'Citas' && <><SectionHeader title="Citas" text="Organiza y administra el calendario de reservas." /><div className="mb-5 flex flex-wrap gap-2">{['todas', 'pendiente', 'confirmada', 'completada', 'cancelada'].map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`filter ${statusFilter === status ? 'active' : ''}`}>{status}</button>)}</div><div className="overflow-x-auto rounded border border-[#c9a84c]/20 bg-[#1a1916]"><table><thead><tr><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>{appointments.filter((item) => statusFilter === 'todas' || item.status === statusFilter).map((item) => <tr key={item.id}><td><strong>{item.client}</strong><span>{item.time} h</span></td><td>{item.service}<span>{item.barber}</span></td><td>{dateLabel(item.date)}</td><td><StatusBadge status={item.status} /></td><td><div className="flex gap-2">{['pendiente', 'confirmada'].includes(item.status) && <button onClick={() => updateAppointment(item.id, item.status === 'pendiente' ? 'confirmada' : 'completada')} className="icon-button" title={item.status === 'pendiente' ? 'Confirmar cita' : 'Marcar como completada'}><Check size={15} /></button>}{item.status !== 'cancelada' && <button onClick={() => setModal({ type: 'appointment', item })} className="icon-button danger" title="Cancelar cita"><X size={15} /></button>}</div></td></tr>)}</tbody></table></div></>}
    {tab === 'Servicios' && <><SectionHeader title="Servicios" text="Catálogo y disponibilidad de tus experiencias." action={<button onClick={() => setModal({ type: 'service' })} className="gold-button"><Plus size={16} /> Nuevo servicio</button>} /><div className="grid gap-3 md:grid-cols-2">{services.map((item) => <div className="list-card" key={item.id}><div><h3 className="font-serif text-xl">{item.name}</h3><p className="mt-1 text-sm text-[#a0a0a0]">{currency.format(item.price)} · {item.duration} min.</p></div><div className="flex items-center gap-2"><button onClick={async () => { const savedItem = await saveCatalogItem('service', { ...item, active: !item.active }); if (savedItem) setServices((items) => items.map((current) => current.id === savedItem.id ? savedItem : current)) }} className={`switch ${item.active ? 'on' : ''}`}><span /></button><button onClick={() => setModal({ type: 'service', item })} className="icon-button"><Edit3 size={15} /></button><button onClick={() => setModal({ type: 'delete-service', item })} className="icon-button danger"><Trash2 size={15} /></button></div></div>)}</div></>}
    {tab === 'Barberos' && <><SectionHeader title="Barberos" text="Administra el equipo y sus especialidades." action={<button onClick={() => setModal({ type: 'barber' })} className="gold-button"><Plus size={16} /> Nuevo barbero</button>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{barbers.map((item) => <div className="rounded border border-[#c9a84c]/20 bg-[#1a1916] p-5" key={item.id}><div className="flex items-start justify-between"><div className={`grid h-14 w-14 place-items-center rounded-full ${item.color} font-serif text-lg`}>{item.initials}</div><div className="flex gap-2"><button onClick={() => setModal({ type: 'barber', item })} className="icon-button"><Edit3 size={15} /></button><button onClick={() => setModal({ type: 'delete-barber', item })} className="icon-button danger"><Trash2 size={15} /></button></div></div><h3 className="mt-5 font-serif text-2xl">{item.name}</h3><p className="mt-1 text-sm text-[#c9a84c]">{item.specialty}</p>{item.isApprentice && <span className="mt-2 inline-block rounded-full border border-[#c9a84c]/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c9a84c]">Aprendiz</span>}</div>)}</div></>}
    {tab === 'Horarios' && <><SectionHeader title="Horarios" text="Configura la disponibilidad general de la barbería." /><div className="max-w-2xl rounded border border-[#c9a84c]/20 bg-[#1a1916] p-6"><h2 className="font-serif text-2xl">Días de atención</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => <button key={day} onClick={() => setSchedule({ ...schedule, days: schedule.days.map((x, n) => n === index ? !x : x) })} className={`day-button ${schedule.days[index] ? 'active' : ''}`}>{day}<span>{schedule.days[index] ? 'Abierto' : 'Cerrado'}</span></button>)}</div><div className="mt-8 grid gap-4 sm:grid-cols-2"><label className="form-label">Apertura<input type="time" value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} className="dark-input" /></label><label className="form-label">Cierre<input type="time" value={schedule.end} onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} className="dark-input" /></label></div><button className="gold-button mt-7">Guardar horarios <Check size={16} /></button></div></>}
  </div>{modal && <EntityModal modal={modal} setModal={setModal} onSave={save} onDelete={remove} />}</div>
}
function Dashboard({ appointments }) { const done = appointments.filter((x) => x.status === 'completada'); const todayAppointments = appointments.filter((x) => x.date === todayValue && x.status !== 'cancelada'); const stats = [['Citas hoy', todayAppointments.length, CalendarDays], ['Citas pendientes', appointments.filter((x) => x.status === 'pendiente').length, Clock3], ['Ingresos completados', currency.format(done.reduce((sum, x) => sum + x.price, 0)), Scissors]]; return <><SectionHeader title="Buenos días, equipo." text={`Agenda de hoy: ${dateLabel(todayValue)}.`} /><div className="grid gap-4 md:grid-cols-3">{stats.map(([label, value, Icon]) => <div key={label} className="stat-card"><Icon className="text-[#c9a84c]" size={20} /><p className="mt-6 text-sm text-[#a0a0a0]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>)}</div><div className="mt-7 rounded border border-[#c9a84c]/20 bg-[#1a1916] p-6"><h2 className="font-serif text-2xl">Citas de hoy</h2><div className="mt-4 divide-y divide-[#c9a84c]/10">{todayAppointments.length ? todayAppointments.map((item) => <div key={item.id} className="flex items-center justify-between py-4 text-sm"><div><strong>{item.client}</strong><p className="mt-1 text-[#a0a0a0]">{item.service} con {item.barber}</p></div><span className="text-[#c9a84c]">{item.time}</span></div>) : <p className="py-5 text-sm text-[#a0a0a0]">No hay citas programadas para hoy.</p>}</div></div></> }
function EntityModal({ modal, setModal, onSave, onDelete }) { const deleteMode = modal.type.startsWith('delete') || modal.type === 'appointment'; const service = modal.type === 'service'; return <div className="modal-backdrop"><div className="modal"><button onClick={() => setModal(null)} className="absolute right-5 top-5 text-[#a0a0a0]"><X size={20} /></button><h2 className="font-serif text-3xl">{deleteMode ? '¿Confirmar acción?' : modal.item ? `Editar ${service ? 'servicio' : 'barbero'}` : `Nuevo ${service ? 'servicio' : 'barbero'}`}</h2>{deleteMode ? <><p className="mt-3 text-sm text-[#a0a0a0]">{modal.type === 'appointment' ? `Cancelar la cita de ${modal.item.client}?` : `Eliminar “${modal.item.name}”? Esta acción no se puede deshacer.`}</p><div className="mt-7 flex justify-end gap-3"><button onClick={() => setModal(null)} className="plain-button">Volver</button><button onClick={onDelete} className="danger-button">{modal.type === 'appointment' ? 'Cancelar cita' : 'Eliminar'}</button></div></> : <form onSubmit={onSave} className="mt-6 grid gap-4"><label className="form-label">{service ? 'Nombre del servicio' : 'Nombre completo'}<input name="name" defaultValue={modal.item?.name} required className="dark-input" /></label>{service ? <div className="grid grid-cols-2 gap-4"><label className="form-label">Precio (MXN)<input name="price" type="number" min="0" defaultValue={modal.item?.price} required className="dark-input" /></label><label className="form-label">Duración (min.)<input name="duration" type="number" min="5" defaultValue={modal.item?.duration} required className="dark-input" /></label></div> : <label className="form-label">Especialidad<input name="specialty" defaultValue={modal.item?.specialty} required className="dark-input" /></label>}{!service && <label className="flex items-center gap-2 text-sm text-[#f5f5f5]"><input type="checkbox" name="isApprentice" defaultChecked={modal.item?.isApprentice} className="h-4 w-4 accent-[#c9a84c]" /> Es aprendiz</label>}<div className="mt-3 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="plain-button">Cancelar</button><button className="gold-button">Guardar <Check size={16} /></button></div></form>}</div></div> }
function SuccessModal({ onClose }) { return <div className="modal-backdrop"><div className="modal text-center"><div className="success-check mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-[#c9a84c] text-[#c9a84c]"><Check size={39} /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#c9a84c]">Reserva confirmada</p><h2 className="mt-2 font-serif text-4xl">Nos vemos pronto.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#a0a0a0]">Tu cita ha sido registrada. Te esperamos para disfrutar una experiencia a tu medida.</p><button onClick={onClose} className="gold-button mx-auto mt-8">Listo</button></div></div> }
function AdminLogin({ onAccess }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const submit = async (event) => { event.preventDefault(); if (!isSupabaseConfigured) return; setLoading(true); setError(''); const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (signInError) setError('No fue posible iniciar sesión. Verifica tus datos.'); else onAccess() }; return <div className="grid min-h-screen place-items-center px-5"><form onSubmit={submit} className="w-full max-w-sm border border-[#c9a84c]/30 bg-[#1a1916] p-8 text-center shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#c9a84c] text-[#c9a84c]"><LockKeyhole size={24} /></div><p className="mt-6 font-serif text-3xl italic text-[#f5f5f5]">Acceso administrativo</p><p className="mt-2 text-sm text-[#a0a0a0]">Ingresa con tu cuenta autorizada.</p>{!isSupabaseConfigured ? <p className="mt-6 border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs leading-5 text-amber-200">Falta configurar Supabase. Consulta el README para añadir las variables de entorno.</p> : <><label className="form-label mt-6 text-left">Correo electrónico<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="dark-input" /></label><label className="form-label mt-4 text-left">Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="dark-input" /></label>{error && <p className="mt-2 text-left text-xs text-red-400">{error}</p>}<button disabled={loading} className="gold-button mt-6 w-full disabled:opacity-50">{loading ? 'Verificando...' : 'Ingresar'} <ChevronRight size={16} /></button></>}</form></div> }
export default function App() {
  const [view, setView] = useState('public')
  const [services, setServices] = useState(initialServices)
  const [barbers, setBarbers] = useState(initialBarbers)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [step, setStep] = useState(1)
  const [booking, setBooking] = useState({ service: null, barber: null, date: bookingDates.find((date) => !isSunday(date)), time: null, name: '', phone: '' })
  const [success, setSuccess] = useState(false)
  const [session, setSession] = useState(null)
  const [occupiedTimes, setOccupiedTimes] = useState([])

  const loadCatalog = async () => {
    if (!supabase) return
    const [{ data: serviceRows }, { data: barberRows }] = await Promise.all([
      supabase.from('services').select('*').order('name'),
      supabase.from('barbers').select('*').order('name'),
    ])
    if (serviceRows) setServices(serviceRows.map(toService))
    if (barberRows) setBarbers(barberRows.map(toBarber))
  }
  const loadOccupiedTimes = async (date) => {
    if (!supabase) {
      const dayAppointments = appointments.filter((item) => item.date === date && item.status !== 'cancelada')
      setOccupiedTimes(dayAppointments.flatMap((item) => requiredSlots(item.time, services.find((service) => service.name === item.service)?.duration || 30)))
      return
    }
    const { data } = await supabase.rpc('booked_appointment_times', { selected_date: date })
    setOccupiedTimes((data || []).flatMap((item) => requiredSlots(item.appointment_time, item.duration || 30)))
  }

  const loadAppointments = async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('appointments').select('*').order('appointment_date').order('appointment_time')
    if (!error) setAppointments(data.map(toAppointment))
  }
  const saveAppointment = async (appointment) => {
    if (!supabase) {
      setAppointments((items) => [appointment, ...items])
      return appointment
    }
    const { error } = await supabase.from('appointments').insert({
      client_name: appointment.client, phone: appointment.phone, service: appointment.service,
      barber: appointment.barber, appointment_date: appointment.date, appointment_time: appointment.time,
      status: appointment.status, price: appointment.price,
    })
    if (error) {
      window.alert(error.code === '23505' ? 'Este horario acaba de ser reservado. Elige otro para continuar.' : 'No fue posible guardar tu cita. Inténtalo de nuevo.')
      await loadOccupiedTimes(appointment.date)
      return null
    }
    await loadOccupiedTimes(appointment.date)
    return appointment
  }
  const updateAppointment = async (id, status) => {
    if (!supabase) { setAppointments((items) => items.map((item) => item.id === id ? { ...item, status } : item)); return }
    const { data, error } = await supabase.from('appointments').update({ status }).eq('id', id).select().single()
    if (!error) setAppointments((items) => items.map((item) => item.id === id ? toAppointment(data) : item))
  }
  const saveCatalogItem = async (type, item) => {
    if (!supabase) return { ...item, id: item.id || Date.now() }
    const table = type === 'service' ? 'services' : 'barbers'
    const payload = type === 'service' ? { name: item.name, price: item.price, duration: item.duration, active: item.active } : { name: item.name, specialty: item.specialty, initials: item.initials, color: item.color, is_apprentice: item.isApprentice }
    const run = (body) => item.id ? supabase.from(table).update(body).eq('id', item.id).select().single() : supabase.from(table).insert(body).select().single()
    let { data, error } = await run(payload)
    if (error && type === 'barber' && (error.code === '42703' || /is_apprentice/i.test(error.message || ''))) {
      const { is_apprentice, ...fallbackPayload } = payload
      ;({ data, error } = await run(fallbackPayload))
      if (!error) window.alert('El barbero se guardó, pero falta actualizar la base de datos para soportar la etiqueta de "Aprendiz". Ejecuta de nuevo supabase/schema.sql en tu proyecto de Supabase.')
    }
    if (error) { window.alert(`No fue posible guardar los cambios. ${error.message || ''}`); return null }
    return type === 'service' ? toService(data) : toBarber({ ...data, is_apprentice: data.is_apprentice ?? item.isApprentice })
  }
  const deleteCatalogItem = async (type, id) => {
    if (!supabase) return true
    const { error } = await supabase.from(type === 'service' ? 'services' : 'barbers').delete().eq('id', id)
    if (error) { window.alert('No fue posible eliminar el registro.'); return false }
    return true
  }

  useEffect(() => {
    if (!supabase) return undefined
    loadCatalog()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) loadAppointments() }, [session])
  useEffect(() => { loadOccupiedTimes(booking.date) }, [booking.date])

  const leaveAdmin = async () => { if (supabase) await supabase.auth.signOut(); setView('public') }
  return <main className="min-h-screen bg-[#0f0e0c] text-[#f5f5f5] antialiased">{view === 'public' ? <PublicBooking {...{ services, barbers, step, setStep, booking, setBooking, success, setSuccess, saveAppointment, occupiedTimes }} /> : session ? <AdminPanel {...{ services, setServices, barbers, setBarbers, appointments, setAppointments, updateAppointment, saveCatalogItem, deleteCatalogItem }} /> : <AdminLogin onAccess={() => setView('admin')} />}<button onClick={() => view === 'public' ? setView('admin-login') : leaveAdmin()} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[#c9a84c]/40 bg-[#1a1916] px-4 py-3 text-sm font-semibold text-[#c9a84c] shadow-2xl transition hover:bg-[#c9a84c] hover:text-[#0f0e0c]">{view === 'public' ? <LayoutDashboard size={17} /> : <Scissors size={17} />}{view === 'public' ? 'Panel admin' : 'Vista cliente'}</button></main>
}
