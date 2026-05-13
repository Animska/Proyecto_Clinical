from typing import Optional, Dict, Any, List
import logging
from datetime import datetime, timedelta
from .database import get_db_connection, get_db_cursor

DURATIONS = {
    "Examen General": 30,
    "Tratamiento": 60,
    "Operación": 120
}

logger = logging.getLogger(__name__)

def authenticate_user(email: str, password: str, role: str) -> Optional[Dict[str, Any]]:
    """
    Verifica si un usuario existe con el email, contraseña y rol especificados.
    """
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return None
            
            query = """
                SELECT id, email, rol 
                FROM usuarios 
                WHERE email = %s AND password_hash = %s AND rol = %s
            """
            cursor.execute(query, (email, password, role))
            user = cursor.fetchone()
            
            if user:
                user_data = {
                    "id": user["id"],
                    "email": user["email"],
                    "rol": user["rol"],
                    "nombre": "Usuario"
                }
                
                if role == "patient":
                    cursor.execute("SELECT id, nombre FROM pacientes WHERE usuario_id = %s", (user["id"],))
                    paciente = cursor.fetchone()
                    if paciente:
                        user_data["paciente_id"] = paciente["id"]
                        user_data["nombre"] = paciente["nombre"]
                elif role == "doctor":
                    cursor.execute("SELECT id, nombre, especialidad FROM medicos WHERE usuario_id = %s", (user["id"],))
                    medico = cursor.fetchone()
                    if medico:
                        user_data["medico_id"] = medico["id"]
                        user_data["nombre"] = medico["nombre"]
                        user_data["especialidad"] = medico["especialidad"]
                elif role == "admin":
                    user_data["nombre"] = "Control de Admin"
                        
                return user_data
            return None
    except Exception as e:
        logger.error(f"Error al autenticar usuario: {e}")
        return None

def create_patient(data: Dict[str, Any]) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            
            query_usuario = "INSERT INTO usuarios (email, password_hash, rol) VALUES (%s, %s, 'patient')"
            cursor.execute(query_usuario, (data['email'], data['password']))
            usuario_id = cursor.lastrowid
            
            query_paciente = "INSERT INTO pacientes (usuario_id, nombre, dni, telefono) VALUES (%s, %s, %s, %s)"
            cursor.execute(query_paciente, (usuario_id, data['nombre'], data['dni'], data['telefono']))
            return True
    except Exception as e:
        logger.error(f"Error al registrar paciente: {e}")
        return False

def get_patient_profile(usuario_id: int) -> Optional[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return None
            
            query = """
                SELECT p.*, u.email 
                FROM pacientes p 
                JOIN usuarios u ON p.usuario_id = u.id 
                WHERE u.id = %s
            """
            cursor.execute(query, (usuario_id,))
            return cursor.fetchone()
    except Exception as e:
        logger.error(f"Error al obtener perfil: {e}")
        return None

def update_patient_profile(usuario_id: int, data: Dict[str, Any]) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            
            cursor.execute("UPDATE usuarios SET email = %s WHERE id = %s", (data['email'], usuario_id))
            
            query_paciente = """
                UPDATE pacientes 
                SET nombre = %s, telefono = %s, direccion = %s, grupo_sanguineo = %s, alergias = %s 
                WHERE usuario_id = %s
            """
            cursor.execute(query_paciente, (
                data['nombre'], data['telefono'], data['direccion'], 
                data['grupo_sanguineo'], data['alergias'], usuario_id
            ))
            return True
    except Exception as e:
        logger.error(f"Error al actualizar perfil: {e}")
        return False

def get_all_doctors() -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT m.*, u.email, DATE_FORMAT(u.creado_en, '%Y-%m-%d') as fecha
                FROM medicos m
                JOIN usuarios u ON m.usuario_id = u.id
                ORDER BY m.nombre ASC
            """
            cursor.execute(query)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener médicos: {e}")
        return []

def create_doctor(data: Dict[str, Any]) -> bool:
    try:
        logger.info(f"Intentando crear médico: {data.get('nombre')} ({data.get('email')})")
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            
            cursor.execute(
                "INSERT INTO usuarios (email, password_hash, rol) VALUES (%s, %s, 'doctor')",
                (data['email'], data['password'])
            )
            usuario_id = cursor.lastrowid
            
            cursor.execute(
                "INSERT INTO medicos (usuario_id, nombre, especialidad, estado) VALUES (%s, %s, %s, %s)",
                (usuario_id, data['nombre'], data['especialidad'], data['estado'])
            )
            return True
    except Exception as e:
        logger.error(f"Error al crear médico: {e}")
        return False

def create_appointment(data: Dict[str, Any]) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            medico_id = data.get('medico_id')
            query = """
                INSERT INTO citas (paciente_id, medico_id, fecha_hora, motivo, sintomas, prioridad_alta)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query, (
                data['paciente_id'],
                medico_id,
                data['fecha_hora'],
                data['motivo'],
                data.get('sintomas'),
                data.get('prioridad_alta', False)
            ))
            return True
    except Exception as e:
        logger.error(f"Error al crear cita: {e}")
        return False

def get_pending_appointments() -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT c.*, p.nombre as paciente_nombre 
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                WHERE c.estado = 'Pendiente'
                ORDER BY c.prioridad_alta DESC, c.fecha_hora ASC
            """
            cursor.execute(query)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener citas pendientes: {e}")
        return []

def update_appointment_status(appointment_id: int, status: str, medico_id: int = None) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            if medico_id:
                query = "UPDATE citas SET estado = %s, medico_id = %s WHERE id = %s"
                cursor.execute(query, (status, medico_id, appointment_id))
            else:
                query = "UPDATE citas SET estado = %s WHERE id = %s"
                cursor.execute(query, (status, appointment_id))
            return True
    except Exception as e:
        logger.error(f"Error al actualizar cita {appointment_id}: {e}")
        return False

def get_all_appointments() -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT c.*, p.nombre as paciente_nombre, m.nombre as medico_nombre
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                JOIN medicos m ON c.medico_id = m.id
                WHERE c.estado = 'Aceptada'
                ORDER BY c.fecha_hora ASC
            """
            cursor.execute(query)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener todas las citas: {e}")
        return []

def get_active_appointments_by_patient(paciente_id: int) -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT c.*, m.nombre as medico_nombre, m.especialidad as medico_especialidad
                FROM citas c
                LEFT JOIN medicos m ON c.medico_id = m.id
                WHERE c.paciente_id = %s AND c.estado IN ('Pendiente', 'Aceptada')
                ORDER BY c.prioridad_alta DESC, c.fecha_hora ASC
            """
            cursor.execute(query, (paciente_id,))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener citas del paciente: {e}")
        return []

def get_all_appointments_by_patient(paciente_id: int) -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT c.*, m.nombre as medico_nombre, m.especialidad as medico_especialidad
                FROM citas c
                LEFT JOIN medicos m ON c.medico_id = m.id
                WHERE c.paciente_id = %s
                ORDER BY c.fecha_hora DESC
            """
            cursor.execute(query, (paciente_id,))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener historial de citas: {e}")
        return []

def get_doctor_appointments_by_day(medico_id: int, fecha: str) -> List[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            query = """
                SELECT 
                    c.id, c.fecha_hora, c.motivo, c.estado, c.paciente_id,
                    p.nombre as paciente_nombre, p.grupo_sanguineo, p.alergias,
                    COALESCE(ip.vitals_altura, h.vitals_altura) as vitals_altura,
                    COALESCE(ip.vitals_peso, h.vitals_peso) as vitals_peso,
                    COALESCE(ip.vitals_respiracion, h.vitals_respiracion) as vitals_respiracion,
                    COALESCE(ip.vitals_presion, h.vitals_presion) as vitals_presion,
                    ip.observaciones
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                LEFT JOIN informe_paciente ip ON c.id = ip.cita_id
                LEFT JOIN (
                    SELECT i1.*
                    FROM informe_paciente i1
                    JOIN (
                        SELECT paciente_id, MAX(id) as max_id
                        FROM informe_paciente
                        GROUP BY paciente_id
                    ) i2 ON i1.id = i2.max_id
                ) h ON p.id = h.paciente_id
                WHERE c.medico_id = %s AND DATE(c.fecha_hora) = %s AND c.estado = 'Aceptada'
                ORDER BY c.fecha_hora ASC
            """
            cursor.execute(query, (medico_id, fecha))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error al obtener citas del médico: {e}")
        return []

def create_or_update_patient_report(data: Dict[str, Any]) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            cursor.execute("SELECT id FROM informe_paciente WHERE cita_id = %s", (data['cita_id'],))
            exists = cursor.fetchone()

            if exists:
                query = """
                    UPDATE informe_paciente 
                    SET vitals_altura = %s, vitals_peso = %s, vitals_respiracion = %s, 
                        vitals_presion = %s, observaciones = %s
                    WHERE cita_id = %s
                """
                params = (
                    data['vitals_altura'], data['vitals_peso'], data['vitals_respiracion'],
                    data['vitals_presion'], data['observaciones'], data['cita_id']
                )
            else:
                cursor.execute("SELECT paciente_id FROM citas WHERE id = %s", (data['cita_id'],))
                cita = cursor.fetchone()
                if not cita:
                    logger.error(f"No se encontró la cita {data['cita_id']} para crear el informe.")
                    return False
                
                paciente_id = cita[0] if isinstance(cita, tuple) else cita['paciente_id']
                
                query = """
                    INSERT INTO informe_paciente 
                    (cita_id, paciente_id, vitals_altura, vitals_peso, vitals_respiracion, vitals_presion, observaciones)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    data['cita_id'], paciente_id, data['vitals_altura'], data['vitals_peso'], 
                    data['vitals_respiracion'], data['vitals_presion'], data['observaciones']
                )
            cursor.execute(query, params)
            
            cursor.execute("UPDATE citas SET estado = 'Completado' WHERE id = %s", (data['cita_id'],))
            return True
    except Exception as e:
        logger.error(f"Error al guardar informe: {e}")
        return False

def get_available_slots(fecha: str, motivo: str) -> List[str]:
    try:
        duracion = DURATIONS.get(motivo, 30)
        
        try:
            inicio_jornada = datetime.strptime(f"{fecha} 09:00:00", "%Y-%m-%d %H:%M:%S")
            fin_jornada = datetime.strptime(f"{fecha} 18:00:00", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return []
            
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return []
            
            cursor.execute("SELECT id FROM medicos WHERE estado = 'Activo'")
            medicos = cursor.fetchall()
            if not medicos: return []
            
            medico_ids = [m['id'] for m in medicos]
            placeholders = ', '.join(['%s'] * len(medico_ids))
            
            cursor.execute(f"SELECT medico_id, fecha_hora, motivo FROM citas WHERE DATE(fecha_hora) = %s AND estado IN ('Pendiente', 'Aceptada') AND medico_id IN ({placeholders})", [fecha] + medico_ids)
            citas_dia = cursor.fetchall()
            
            huecos_disponibles = []
            actual = inicio_jornada
            
            while actual + timedelta(minutes=duracion) <= fin_jornada:
                slot_disponible_para_algun_medico = False
                
                for medico_id in medico_ids:
                    citas_medico = [c for c in citas_dia if c.get('medico_id') == medico_id]
                    medico_libre = True
                    
                    for cita in citas_medico:
                        cita_inicio = cita['fecha_hora']
                        if isinstance(cita_inicio, str):
                            cita_inicio = datetime.strptime(cita_inicio, "%Y-%m-%d %H:%M:%S")
                            
                        cita_duracion = DURATIONS.get(cita['motivo'], 30)
                        cita_fin = cita_inicio + timedelta(minutes=cita_duracion)
                        
                        propuesto_inicio = actual
                        propuesto_fin = actual + timedelta(minutes=duracion)
                        
                        if (propuesto_inicio < cita_fin and propuesto_fin > cita_inicio):
                            medico_libre = False
                            break
                            
                    if medico_libre:
                        slot_disponible_para_algun_medico = True
                        break
                        
                if slot_disponible_para_algun_medico:
                    huecos_disponibles.append(actual.strftime("%H:%M"))
                    
                actual += timedelta(minutes=30)
                
            return huecos_disponibles
    except Exception as e:
        logger.error(f"Error al calcular huecos: {e}")
        return []

def get_latest_report_by_patient(paciente_id: int) -> Optional[Dict[str, Any]]:
    try:
        with get_db_cursor(dictionary=True) as cursor:
            if not cursor: return None
            query = """
                SELECT ip.*, DATE_FORMAT(c.fecha_hora, '%d/%m/%Y %H:%i') as fecha_cita, m.nombre as medico_nombre
                FROM informe_paciente ip
                JOIN citas c ON ip.cita_id = c.id
                JOIN medicos m ON c.medico_id = m.id
                WHERE ip.paciente_id = %s
                ORDER BY c.fecha_hora DESC
                LIMIT 1
            """
            cursor.execute(query, (paciente_id,))
            return cursor.fetchone()
    except Exception as e:
        logger.error(f"Error al obtener el último informe: {e}")
        return None

def update_doctor(medico_id: int, data: Dict[str, Any]) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            cursor.execute("SELECT usuario_id FROM medicos WHERE id = %s", (medico_id,))
            usuario = cursor.fetchone()
            if not usuario: return False
            usuario_id = usuario[0] if isinstance(usuario, tuple) else usuario['usuario_id']
            
            cursor.execute("UPDATE usuarios SET email = %s WHERE id = %s", (data['email'], usuario_id))
            cursor.execute(
                "UPDATE medicos SET nombre = %s, especialidad = %s, estado = %s WHERE id = %s",
                (data['nombre'], data['especialidad'], data['estado'], medico_id)
            )
            return True
    except Exception as e:
        logger.error(f"Error al actualizar médico: {e}")
        return False

def delete_doctor(medico_id: int) -> bool:
    try:
        with get_db_cursor(commit_on_success=True) as cursor:
            if not cursor: return False
            cursor.execute("SELECT usuario_id FROM medicos WHERE id = %s", (medico_id,))
            usuario = cursor.fetchone()
            if not usuario: return False
            usuario_id = usuario[0] if isinstance(usuario, tuple) else usuario['usuario_id']
            
            cursor.execute("DELETE FROM medicos WHERE id = %s", (medico_id,))
            cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
            return True
    except Exception as e:
        logger.error(f"Error al eliminar médico: {e}")
        return False
