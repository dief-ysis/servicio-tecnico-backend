const { z } = require('zod')

// ── Auth ─────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Email inválido').max(100),
  password: z.string().min(1, 'La contraseña es requerida').max(200)
})

// ── Clientes ─────────────────────────────────────────
const crearClienteSchema = z.object({
  nombre:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  telefono: z.string().max(20).optional().nullable(),
  email:    z.string().email('Email inválido').max(100).optional().nullable()
    .or(z.literal('').transform(() => null))
})

const actualizarClienteSchema = z.object({
  nombre:   z.string().min(2).max(100).optional(),
  telefono: z.string().max(20).optional().nullable(),
  email:    z.string().email('Email inválido').max(100).optional().nullable()
    .or(z.literal('').transform(() => null))
})

// ── Equipos ──────────────────────────────────────────
const crearEquipoSchema = z.object({
  cliente_id:      z.coerce.number().int().positive('cliente_id debe ser un número válido'),
  tipo_equipo:     z.string().min(1, 'El tipo de equipo es requerido').max(50),
  marca:           z.string().max(50).optional().nullable(),
  modelo:          z.string().max(50).optional().nullable(),
  falla_reportada: z.string().max(2000).optional().nullable(),
  accesorios:      z.string().max(1000).optional().nullable(),
  observaciones:   z.string().max(2000).optional().nullable(),
  password_pin:    z.string().max(50).optional().nullable()
})

const actualizarEquipoSchema = z.object({
  tipo_equipo:      z.string().min(1).max(50).optional(),
  marca:            z.string().max(50).optional().nullable(),
  modelo:           z.string().max(50).optional().nullable(),
  falla_reportada:  z.string().max(2000).optional().nullable(),
  diagnostico:      z.string().max(2000).optional().nullable(),
  accesorios:       z.string().max(1000).optional().nullable(),
  observaciones:    z.string().max(2000).optional().nullable(),
  password_pin:     z.string().max(50).optional().nullable(),
  notas_tecnico:    z.string().max(2000).optional().nullable(),
  costo_reparacion: z.coerce.number().int('El costo debe ser un número entero').nonnegative().optional().nullable(),
  garantia_dias:    z.coerce.number().int().nonnegative().max(3650).optional().nullable()
})

const cambiarEstadoSchema = z.object({
  estado: z.enum(
    ['por_reparar', 'en_reparacion', 'espera_repuesto', 'reparado', 'irreparable', 'entregado'],
    { errorMap: () => ({ message: 'Estado inválido' }) }
  )
})

// ── Usuarios ─────────────────────────────────────────
const crearUsuarioSchema = z.object({
  nombre:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email:    z.string().email('Email inválido').max(100),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
  rol:      z.enum(['recepcionista', 'tecnico'], { errorMap: () => ({ message: 'Rol inválido' }) })
})

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  rol:    z.enum(['recepcionista', 'tecnico']).optional(),
  activo: z.boolean().optional()
})

const cambiarPasswordSchema = z.object({
  password_actual: z.string().min(1, 'La contraseña actual es requerida'),
  password_nuevo:  z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(200)
})

module.exports = {
  loginSchema,
  crearClienteSchema,
  actualizarClienteSchema,
  crearEquipoSchema,
  actualizarEquipoSchema,
  cambiarEstadoSchema,
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  cambiarPasswordSchema
}
