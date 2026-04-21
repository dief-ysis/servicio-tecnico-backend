/**
 * Seed de demostración — Light Solution Servicio Técnico
 * Crea ~12 clientes ficticios y 100 equipos de iluminación/escenografía
 * Los bsale_id ficticios usan el rango 99001–99020 para no colisionar con BSale real
 *
 * Uso: node src/db/seeds/seed_demo.js
 */
require('dotenv').config()
const pool = require('../connection')

const CLIENTES = [
  { bsale_id: 99001, nombre: 'Teatro Municipal de Santiago',   telefono: '+56225632820', email: 'tecnica@teatromunicipal.cl' },
  { bsale_id: 99002, nombre: 'Productora Lumínica SpA',        telefono: '+56912345678', email: 'produccion@luminica.cl' },
  { bsale_id: 99003, nombre: 'Events Pro Chile',               telefono: '+56987654321', email: 'contacto@eventspro.cl' },
  { bsale_id: 99004, nombre: 'DJ Andrés Morales',              telefono: '+56934567890', email: 'andres.morales@gmail.com' },
  { bsale_id: 99005, nombre: 'América Creativa Producciones',  telefono: '+56223456789', email: 'info@americacreativa.cl' },
  { bsale_id: 99006, nombre: 'Sonido & Luz Ltda',              telefono: '+56956789012', email: 'servicios@sonidoluz.cl' },
  { bsale_id: 99007, nombre: 'Eduardo Caroca',                 telefono: '+56978901234', email: 'ecaroca@hotmail.com' },
  { bsale_id: 99008, nombre: 'Julio Pillo',                    telefono: '+56945678901', email: 'juliop@gmail.com' },
  { bsale_id: 99009, nombre: 'La Boîte Club',                  telefono: '+56226789012', email: 'produccion@laboite.cl' },
  { bsale_id: 99010, nombre: 'Sound Stage Chile',              telefono: '+56967890123', email: 'hola@soundstage.cl' },
  { bsale_id: 99011, nombre: 'Circo del Mundo SpA',            telefono: '+56223344556', email: 'logistica@circodelmundo.cl' },
  { bsale_id: 99012, nombre: 'Daniela Fuentes',                telefono: '+56912223344', email: 'daniela.fuentes@gmail.com' },
]

const EQUIPOS_TEMPLATES = [
  // Cabezas móviles
  { tipo: 'Cabeza Móvil', marca: 'Robe',    modelos: ['Robin 600E Spot', 'BMFL Spot', 'Spiider', 'MegaPointe'] },
  { tipo: 'Cabeza Móvil', marca: 'Martin',  modelos: ['MAC Viper Profile', 'MAC 101', 'MAC Quantum Spot'] },
  { tipo: 'Cabeza Móvil', marca: 'CHAUVET', modelos: ['Rogue R2 Spot', 'Rogue R3 Wash', 'Intimidator Spot 475z'] },
  { tipo: 'Cabeza Móvil', marca: 'ADJ',     modelos: ['Vizi Beam 12RX', 'Vizi Spot Pro', 'Focus Spot 4Z'] },
  { tipo: 'Cabeza Móvil', marca: 'Vari-Lite', modelos: ['VL3500 Spot', 'VL2500 Spot', 'VL1000 AS'] },
  // PAR LED
  { tipo: 'PAR LED',   marca: 'Chauvet DJ', modelos: ['SlimPAR Pro RGBA', 'SlimPAR 64 RGBA', 'COLORado 1 Solo'] },
  { tipo: 'PAR LED',   marca: 'American DJ', modelos: ['Mega Par Profile Plus', '64B LED Pro', 'Dotz Par'] },
  { tipo: 'PAR LED',   marca: 'Elation',     modelos: ['SIXPAR 300', 'SIXPAR 100', 'Colour 5'] },
  // Barras LED
  { tipo: 'Barra LED', marca: 'CHAUVET',    modelos: ['COLORband PiX M USB', 'ÉPIX Strip IP', 'COLORband T3 BT'] },
  { tipo: 'Barra LED', marca: 'Martin',     modelos: ['RUSH Batten 1', 'ERA 150 Profile'] },
  // Follow spot
  { tipo: 'Follow Spot', marca: 'Robert Juliat', modelos: ['Lancelot 2500 HMI', 'Aramis 613SX'] },
  { tipo: 'Follow Spot', marca: 'Strong',         modelos: ['Gladiator II 4000', 'Super Trouper'] },
  // Estrobos
  { tipo: 'Estrobo',  marca: 'Martin',    modelos: ['Atomic 3000 LED', 'Atomic Colors'] },
  { tipo: 'Estrobo',  marca: 'CHAUVET',   modelos: ['Intimidator Strobe 400', 'Hurricane Haze H1'] },
  // Dimmers
  { tipo: 'Dimmer Rack', marca: 'ETC',    modelos: ['Sensor3 48x2.4kW', 'SmartPack 12'] },
  { tipo: 'Dimmer',      marca: 'Strand', modelos: ['CD80 2.4kW', 'SDR 2.4kW'] },
  // Controladores
  { tipo: 'Controlador DMX', marca: 'MA Lighting', modelos: ['grandMA2 Light', 'grandMA3 Full-size', 'dot2 Core'] },
  { tipo: 'Controlador DMX', marca: 'Avolites',    modelos: ['Pearl Expert Touch', 'Quartz', 'Titan Mobile'] },
  { tipo: 'Controlador DMX', marca: 'CHAUVET',     modelos: ['ShowXpress Live Touch', 'DMX-AN'] },
  // Humo y haze
  { tipo: 'Máquina de Humo', marca: 'Look Solutions', modelos: ['Unique 2.1', 'Viper NT', 'Power Tiny'] },
  { tipo: 'Hazer',           marca: 'Look Solutions', modelos: ['Haze Generator', 'Unique Hazer 1400'] },
  { tipo: 'Máquina de Humo', marca: 'CHAUVET',        modelos: ['Nimbus Dry Ice Machine', 'H1100'] },
  // Láser
  { tipo: 'Láser',  marca: 'Kvant',   modelos: ['Spectrum 30', 'Clubmax 6000 FB3'] },
  { tipo: 'Láser',  marca: 'Pangolin', modelos: ['LD2000', 'QuickShow'] },
]

const FALLAS = [
  'No enciende', 'Pantalla dañada', 'Error de comunicación DMX', 'Pan/Tilt no funciona',
  'Colores incorrectos', 'Gobo atascado', 'Ruido excesivo en el motor', 'LED quemado',
  'Error de zoom', 'Foco no funciona', 'Intermitencia en la luz', 'Ventilador roto',
  'No responde a controlador', 'Falla en prism', 'Iris atascado', 'Cable de alimentación dañado',
  'Error E01 en pantalla', 'Cabezal no gira 360°', 'Pérdida de potencia', 'Quemadura de fuente',
  'Cristal del gobo roto', 'Lente rayada', 'Encoder de pan dañado', 'Placa de control quemada',
  'Humo escaso', 'No calienta', 'Bomba de humo dañada', 'Fuga de humo interno',
]

const DIAGNOSTICOS = [
  'Se revisa circuito de alimentación. Fuente SMPS dañada, requiere reemplazo.',
  'Placa principal con corrosión por humedad. Se limpia y reemplaza componentes.',
  'Motor de pan quemado. Se reemplaza por repuesto original.',
  'LED array central con 3 módulos fallados. Se cambian por módulos compatibles.',
  'Driver DMX dañado. Se reemplaza IC SN75176B.',
  'Encoder óptico de tilt roto. Se reemplaza por encoder incremental de 600ppr.',
  'Ventilador principal bloqueado por polvo. Se limpia y lubrica.',
  'Condensador electrolítico reventado en fuente. Se reemplaza.',
  'Cristal de gobo roto. Se reemplaza por gobo estándar B.',
  'Prism motor quemado. Requiere repuesto del fabricante.',
  null,
]

const NOTAS = [
  'Cliente indica que falló en show en vivo.',
  'Equipo fue transportado mal, llegó con golpes.',
  'Se recibe sin accesorios. Cliente fue notificado.',
  'Mismo problema que tuvo hace 6 meses.',
  'En espera de cotización de repuesto con proveedor.',
  'Repuesto pedido a proveedor en España.',
  null,
]

const ESTADOS = [
  ...Array(22).fill('por_reparar'),
  ...Array(25).fill('en_reparacion'),
  ...Array(12).fill('espera_repuesto'),
  ...Array(18).fill('reparado'),
  ...Array(15).fill('entregado'),
  ...Array(8).fill('irreparable'),
]

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

function fechaHaceDias(dias, variacion = 0) {
  const d = new Date()
  d.setDate(d.getDate() - dias - rndInt(0, variacion))
  return d.toISOString()
}

async function run() {
  console.log('🌱 Iniciando seed de demo...')

  // 1. Insertar clientes ficticios
  console.log('→ Insertando clientes...')
  const clienteIds = []
  for (const c of CLIENTES) {
    const r = await pool.query(
      `INSERT INTO clientes (nombre, telefono, email, bsale_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bsale_id) WHERE bsale_id IS NOT NULL
       DO UPDATE SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono, email = EXCLUDED.email
       RETURNING id`,
      [c.nombre, c.telefono, c.email, c.bsale_id]
    )
    clienteIds.push(r.rows[0].id)
  }
  // Incluir el cliente real existente (id 9)
  const todosLosIds = [...clienteIds, 9]
  console.log(`  ✓ ${todosLosIds.length} clientes listos`)

  // 2. Obtener el próximo número de ingreso
  const anio = new Date().getFullYear()

  // 3. Insertar equipos
  console.log('→ Insertando 100 equipos...')
  const shuffledEstados = [...ESTADOS].sort(() => Math.random() - 0.5)

  for (let i = 0; i < 100; i++) {
    const tmpl    = rnd(EQUIPOS_TEMPLATES)
    const modelo  = rnd(tmpl.modelos)
    const estado  = shuffledEstados[i]
    const cliente = rnd(todosLosIds)
    const falla   = rnd(FALLAS)
    const diag    = estado === 'por_reparar' ? null : rnd(DIAGNOSTICOS)
    const nota    = Math.random() > 0.6 ? rnd(NOTAS) : null

    // Fechas realistas según estado
    const diasIngreso = rndInt(1, 120)
    const fechaIngreso = fechaHaceDias(diasIngreso)

    let costo = null
    let fechaEntrega = null
    let garantiaDias = null

    if (['reparado', 'entregado', 'irreparable'].includes(estado)) {
      costo = estado === 'irreparable' ? null : rndInt(15, 120) * 1000
    }
    if (estado === 'entregado') {
      fechaEntrega = fechaHaceDias(rndInt(0, diasIngreso - 1))
      garantiaDias = rnd([0, 30, 60, 90])
    }

    // accesorios
    const accesorios = Math.random() > 0.5
      ? rnd(['Cable DMX', 'Carcasa', 'Control remoto', 'Cable de poder', 'Maleta de transporte', 'Manual'])
      : null

    // Generar número de ingreso primero (igual que el controller)
    const numResult = await pool.query(
      `SELECT siguiente_numero_ingreso($1::SMALLINT) AS siguiente`, [anio]
    )
    const numIngreso = `ST-${anio}-${String(numResult.rows[0].siguiente).padStart(4, '0')}`

    const r = await pool.query(
      `INSERT INTO equipos (
        numero_ingreso, cliente_id, tipo_equipo, marca, modelo, falla_reportada,
        diagnostico, notas_tecnico, estado_actual, accesorios,
        costo_reparacion, fecha_ingreso, fecha_entrega, garantia_dias
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        numIngreso, cliente, tmpl.tipo, tmpl.marca, modelo, falla,
        diag, nota, estado, accesorios,
        costo, fechaIngreso, fechaEntrega, garantiaDias ?? 0
      ]
    )

    const equipoId = r.rows[0].id

    // Insertar cambio de estado en historial (para que sin-movimiento funcione)
    const usuarioAdmin = await pool.query(`SELECT id FROM usuarios LIMIT 1`)
    const uid = usuarioAdmin.rows[0]?.id ?? 1

    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
       VALUES ($1, $2, 'estado', 'ingreso', $3, $4)`,
      [equipoId, uid, estado, fechaHaceDias(rndInt(1, Math.min(diasIngreso, 30)))]
    )
  }

  console.log('  ✓ 100 equipos insertados')
  console.log('✅ Seed completado')
  process.exit(0)
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
