from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error as MySQLError
import os
import uvicorn
from google import genai
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

from api.database import initialize_database, get_db_connection
from api.schemas import (
    LoginRequest, LoginResponse, RegisterPatientRequest, PatientProfileResponse, 
    UpdateProfileRequest, RegisterDoctorRequest, DoctorResponse, DoctorUpdate,
    AppointmentCreate, AppointmentUpdate, PatientReportCreate, PatientReportResponse
)
from api.repository import (
    authenticate_user, create_patient, get_patient_profile, update_patient_profile, 
    get_all_doctors, create_doctor, update_doctor, delete_doctor,
    create_appointment, get_pending_appointments, update_appointment_status, 
    get_all_appointments, get_active_appointments_by_patient, get_all_appointments_by_patient, 
    get_doctor_appointments_by_day, create_or_update_patient_report, get_available_slots, 
    get_latest_report_by_patient
)

# Inicializar Base de Datos al arrancar el script
initialize_database()

# Configurar Gemini (Nueva SDK google-genai)
ai_client = None
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    ai_client = genai.Client(api_key=gemini_key)

app = FastAPI(title="Clinica Rodriguez API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# Endpoints de Autenticación
@app.post("/api/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(request: LoginRequest):
    """
    Endpoint para iniciar sesión. Valida las credenciales contra la base de datos.
    """
    user_data = authenticate_user(request.email, request.password, request.role)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas o rol no autorizado"
        )
        
    return LoginResponse(
        message="Inicio de sesión exitoso",
        user_data=user_data
    )

@app.post("/api/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterPatientRequest):
    """
    Endpoint para registrar un nuevo paciente.
    """
    try:
        data = request.model_dump()
        create_patient(data)
        return {"message": "Paciente registrado exitosamente"}
    except MySQLError as e:
        if e.errno == 1062:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico o DNI ya está registrado."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar el registro."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/profile/{usuario_id}", response_model=PatientProfileResponse)
async def get_profile(usuario_id: int):
    """
    Obtiene los datos detallados del perfil de un paciente específico.
    """
    profile = get_patient_profile(usuario_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return profile

@app.put("/api/profile/{usuario_id}")
async def update_profile(usuario_id: int, request: UpdateProfileRequest):
    """
    Actualiza la información personal y médica del perfil de un paciente.
    """
    success = update_patient_profile(usuario_id, request.model_dump())
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar el perfil")
    return {"message": "Perfil actualizado correctamente"}

@app.get("/api/doctors", response_model=list[DoctorResponse])
async def list_doctors():
    """
    Devuelve un listado completo de todos los médicos registrados en el sistema.
    """
    return get_all_doctors()

@app.post("/api/doctors", status_code=status.HTTP_201_CREATED)
async def add_doctor(request: RegisterDoctorRequest):
    """
    Crea un nuevo registro de médico en la base de datos.
    """
    try:
        success = create_doctor(request.model_dump())
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo crear el médico.")
        return {"message": "Médico creado exitosamente"}
    except MySQLError as e:
        if e.errno == 1062:
            raise HTTPException(status_code=400, detail="El email ya está registrado.")
        raise HTTPException(status_code=500, detail="Error de base de datos.")

@app.put("/api/doctors/{id}")
async def update_doc(id: int, request: DoctorUpdate):
    """
    Actualiza la información (nombre, especialidad, etc.) de un médico existente.
    """
    success = update_doctor(id, request.model_dump())
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar el médico.")
    return {"message": "Médico actualizado correctamente"}

@app.delete("/api/doctors/{id}")
async def delete_doc(id: int):
    """
    Elimina permanentemente a un médico del sistema por su ID.
    """
    success = delete_doctor(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al eliminar el médico.")
    return {"message": "Médico eliminado correctamente"}

@app.post("/api/appointments", status_code=status.HTTP_201_CREATED)
async def add_appointment(request: AppointmentCreate):
    """
    Registra una nueva solicitud de cita médica en el sistema.
    """
    success = create_appointment(request.model_dump())
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al programar la cita.")
    return {"message": "Cita programada exitosamente"}

@app.get("/api/appointments/pending")
async def list_pending_appointments():
    """
    Lista todas las citas que aún no han sido asignadas a un médico o aceptadas.
    """
    return get_pending_appointments()

@app.get("/api/appointments/patient/{paciente_id}")
async def list_patient_appointments(paciente_id: int):
    """
    Lista las citas activas o próximas para un paciente en particular.
    """
    return get_active_appointments_by_patient(paciente_id)

@app.get("/api/appointments/patient/{paciente_id}/history")
async def list_patient_appointment_history(paciente_id: int):
    """
    Recupera el historial completo de citas (pasadas y futuras) de un paciente.
    """
    return get_all_appointments_by_patient(paciente_id)

@app.get("/api/appointments/doctor/{medico_id}")
async def list_doctor_appointments(medico_id: int, fecha: str):
    """
    Obtiene la agenda de citas programadas para un médico en una fecha específica.
    """
    return get_doctor_appointments_by_day(medico_id, fecha)

@app.get("/api/appointments/available_slots")
async def available_slots(fecha: str, motivo: str):
    """Devuelve los huecos disponibles basados en las citas existentes y la duración del motivo."""
    slots = get_available_slots(fecha, motivo)
    return {"available_slots": slots}

@app.get("/api/appointments")
async def list_all_appointments():
    """
    Lista todas las citas aceptadas globalmente, útil para visualización en calendarios.
    """
    return get_all_appointments()

@app.patch("/api/appointments/{id}")
async def update_appointment(id: int, request: AppointmentUpdate):
    """
    Actualiza el estado de una cita (Aceptada, Cancelada, Completada) o asigna un médico.
    """
    success = update_appointment_status(id, request.estado, request.medico_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar la cita.")
    return {"message": "Cita actualizada correctamente"}

@app.post("/api/reports", status_code=status.HTTP_201_CREATED)
async def save_report(request: PatientReportCreate):
    """
    Crea un informe médico y registra las constantes vitales tras una consulta.
    """
    success = create_or_update_patient_report(request.model_dump())
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al guardar el informe.")
    return {"message": "Informe guardado correctamente"}

@app.get("/api/reports/patient/{paciente_id}/latest", response_model=PatientReportResponse)
async def get_latest_report(paciente_id: int):
    """
    Recupera el informe médico más reciente de un paciente, incluyendo sus últimos vitales.
    """
    report = get_latest_report_by_patient(paciente_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró ningún informe para este paciente")
    return report

# Montar las carpetas estáticas y vistas
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/views", StaticFiles(directory="views"), name="views")

@app.get("/")
async def read_index():
    """
    Punto de entrada principal de la aplicación. Sirve el archivo index.html 
    que gestiona toda la interfaz SPA.
    """
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Index no encontrado")

@app.get("/health")
async def health_check():
    """
    Endpoint de diagnóstico para verificar el estado de la API y su 
    capacidad de conexión con la base de datos MySQL.
    """
    conn = get_db_connection()
    if conn:
        conn.close()
        return {"status": "ok", "database": "connected"}
    
    raise HTTPException(status_code=500, detail="Database connection failed")


# ==============================================================================
# SECCIÓN DE INTELIGENCIA ARTIFICIAL (Gemini AI)
# ==============================================================================

class AIRecommendRequest(BaseModel):
    slots: list[str]
    fecha: str
    motivo: str
    sintomas: Optional[str] = None

@app.post("/api/ai/recommend")
async def recommend_slot(request: AIRecommendRequest):
    """
    Utiliza IA para recomendar el mejor horario disponible para una cita basándose 
    en el motivo y los síntomas reportados por el paciente.
    """
    if not ai_client:
        return {"recommendation": "¡Hola! Veo que tienes varios huecos disponibles. Te recomiendo elegir el que mejor se adapte a tu rutina. (Nota: Configura GEMINI_API_KEY para recomendaciones personalizadas)."}
    
    if not request.slots:
        return {"recommendation": "Lo siento, no parece haber huecos libres para este día."}

    try:
        prompt = f"""
        Actúa como un asistente virtual extremadamente amable y profesional de la 'Clínica Rodríguez'.
        Tu objetivo es ayudar al paciente a elegir la mejor hora para su cita.
        
        Datos de la solicitud:
        - Motivo: {request.motivo}
        - Síntomas reportados: {request.sintomas or 'No especificados'}
        - Fecha: {request.fecha}
        - Horas disponibles: {', '.join(request.slots)}
        
        Instrucciones:
        1. Saluda cordialmente.
        2. Recomienda una o dos de las horas disponibles.
        3. Si el motivo es 'Operación', prioriza las primeras horas de la mañana.
        4. Sé muy breve (máximo 50 palabras).
        5. Usa un tono que transmita confianza y cuidado.
        6. NO uses markdown complejo, solo texto plano o negritas simples.
        """
        response = ai_client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt
        )
        return {"recommendation": response.text.strip()}
    except Exception as e:
        import logging
        logging.error(f"Error en Gemini: {str(e)}")
        return {"recommendation": f"Te recomiendo el hueco de las {request.slots[0]}, es una excelente hora para tu consulta de {request.motivo}."}

class AISuggestReportRequest(BaseModel):
    altura: float
    peso: float
    respiracion: int
    presion: str
    especialidad: str
    sintomas: Optional[str] = None

@app.post("/api/ai/suggest-report")
async def suggest_report(request: AISuggestReportRequest):
    """
    Analiza las constantes vitales y los síntomas del paciente para generar 
    una observación clínica profesional sugerida para el médico.
    """
    if not ai_client:
        return {"suggestion": "Signos vitales estables. Paciente en condiciones generales normales para su edad y complexión. Se recomienda mantener hábitos saludables."}
    
    try:
        prompt = f"""
        Actúa como un médico experto en {request.especialidad}.
        Redacta una observación clínica breve (máximo 60 palabras) basada en estos datos:
        
        SÍNTOMAS REPORTADOS POR EL PACIENTE:
        {request.sintomas or 'No especificados'}
        
        SIGNOS VITALES ACTUALES:
        - Altura: {request.altura} cm
        - Peso: {request.peso} kg
        - Respiración: {request.respiracion} rpm
        - Presión Arterial: {request.presion}
        
        Instrucciones:
        1. El tono debe ser estrictamente profesional, médico y sintético.
        2. Analiza la relación entre los síntomas reportados y los signos vitales.
        3. Incluye una breve mención al IMC si es relevante.
        4. Sugiere una posible línea de acción o diagnóstico preliminar.
        """
        response = ai_client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt
        )
        return {"suggestion": response.text.strip()}
    except Exception as e:
        return {"suggestion": "Paciente presenta constantes vitales dentro de la normalidad. Se recomienda seguimiento en la próxima consulta."}

class AIDoctorRequest(BaseModel):
    sintomas: str
    motivo: str
    doctores: list[dict]

@app.post("/api/ai/recommend-doctor")
async def recommend_doctor(request: AIDoctorRequest):
    """
    Asistente de triaje que recomienda al médico más adecuado basándose en 
    la especialidad, el motivo de consulta y los síntomas.
    """
    if not ai_client:
        return {"recommendation": "Sugerencia: Revisa las especialidades disponibles para asignar al profesional más adecuado."}
    
    try:
        docs_str = "\n".join([f"- {d['nombre']} ({d['especialidad']})" for d in request.doctores])
        prompt = f"""
        Actúa como un jefe de planta médico en la Clínica Rodríguez.
        Basándote en los síntomas del paciente y el motivo de consulta, recomienda al doctor más apto.
        
        Datos:
        - Motivo: {request.motivo}
        - Síntomas: {request.sintomas}
        
        Plantilla médica disponible:
        {docs_str}
        
        Responde con una recomendación profesional muy breve (máximo 40 palabras).
        """
        response = ai_client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt
        )
        return {"recommendation": response.text.strip()}
    except Exception as e:
        return {"recommendation": "Sugerencia: Se recomienda asignar al médico cuya especialidad coincida con el motivo de consulta."}



if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
